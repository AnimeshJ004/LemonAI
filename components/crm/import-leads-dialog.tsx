"use client";

import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileText,
  Users,
} from "lucide-react";

interface ImportLeadsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

interface ParsedLead {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  deal_value?: number;
  stage?: string;
  source?: string;
  notes?: string;
}

export function ImportLeadsDialog({
  isOpen,
  onClose,
  onImportSuccess,
}: ImportLeadsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedLead[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setParsedRows([]);
    setIsParsing(false);
    setIsImporting(false);
    setImportProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processCsvFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.name.endsWith(".csv")) {
      processCsvFile(dropped);
    } else {
      toast.error("Please drop a valid .csv file");
    }
  };

  const parseCsvText = (text: string): ParsedLead[] => {
    const lines = text
      .split(/\r\n|\n|\r/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return [];

    // Simple CSV row parser handling quotes
    const parseRow = (line: string): string[] => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    };

    const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const results: ParsedLead[] = [];

    // Find indices for standard fields
    const getIndex = (aliases: string[]) =>
      headers.findIndex((h) => aliases.some((a) => h.includes(a)));

    const nameIdx = getIndex(["name", "prospect", "contact", "fullname"]);
    const emailIdx = getIndex(["email", "mail"]);
    const phoneIdx = getIndex(["phone", "tel", "mobile"]);
    const companyIdx = getIndex(["company", "org", "business"]);
    const valueIdx = getIndex(["value", "deal", "amount", "budget"]);
    const stageIdx = getIndex(["stage", "status"]);
    const sourceIdx = getIndex(["source", "channel", "origin"]);
    const notesIdx = getIndex(["notes", "note", "desc", "comment"]);

    for (let i = 1; i < lines.length; i++) {
      const row = parseRow(lines[i]);
      if (row.length === 0 || row.every((c) => !c)) continue;

      const lead: ParsedLead = {};
      if (nameIdx !== -1 && row[nameIdx]) lead.name = row[nameIdx];
      if (emailIdx !== -1 && row[emailIdx]) lead.email = row[emailIdx];
      if (phoneIdx !== -1 && row[phoneIdx]) lead.phone = row[phoneIdx];
      if (companyIdx !== -1 && row[companyIdx]) lead.company = row[companyIdx];
      if (valueIdx !== -1 && row[valueIdx]) {
        const val = Number(row[valueIdx].replace(/[^0-9.]/g, ""));
        if (!isNaN(val)) lead.deal_value = val;
      }
      if (stageIdx !== -1 && row[stageIdx]) {
        const s = row[stageIdx].toLowerCase().replace(/\s+/g, "_");
        lead.stage = ["new", "contacted", "qualified", "booked", "proposal", "closed_won", "closed_lost"].includes(s)
          ? s
          : "new";
      }
      if (sourceIdx !== -1 && row[sourceIdx]) lead.source = row[sourceIdx].toLowerCase();
      if (notesIdx !== -1 && row[notesIdx]) lead.notes = row[notesIdx];

      // If at least name, email, or phone is present
      if (lead.name || lead.email || lead.phone) {
        results.push(lead);
      }
    }

    return results;
  };

  const processCsvFile = (f: File) => {
    if (!f.name.endsWith(".csv")) {
      toast.error("Please upload a .csv file");
      return;
    }
    setFile(f);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = parseCsvText(text);
        if (parsed.length === 0) {
          toast.error("No valid contacts found in CSV file. Ensure columns include Name, Email, or Phone.");
          setFile(null);
        } else {
          setParsedRows(parsed);
          toast.success(`Found ${parsed.length} prospects ready to import!`);
        }
      } catch (err: any) {
        toast.error("Failed to parse CSV file: " + (err?.message || "Invalid format"));
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setIsImporting(true);
    setImportProgress(0);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      try {
        const res = await fetch("/api/crm/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.name || "Imported Prospect",
            email: row.email || null,
            phone: row.phone || null,
            company: row.company || "",
            deal_value: row.deal_value || 0,
            stage: row.stage || "new",
            source: row.source || "manual",
            notes: row.notes || "Imported via CSV",
            score: 6,
          }),
        });
        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
      setImportProgress(Math.round(((i + 1) / parsedRows.length) * 100));
    }

    setIsImporting(false);
    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} leads into CRM!`);
      onImportSuccess();
      resetState();
      onClose();
    } else {
      toast.error(`Failed to import leads. (${failCount} errors)`);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          resetState();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            <span>Import Leads from CSV</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Upload any CSV spreadsheet of prospects. Column names like Name, Email, Phone, Company, and Deal Value will be automatically detected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {!file ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-xl p-8 text-center cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40 flex flex-col items-center justify-center gap-3"
            >
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Upload className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Click to choose a CSV or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports standard CSV files with headers (e.g. from HubSpot, Salesforce, Excel)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-card/60">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground truncate max-w-[260px]">
                      {file.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} prospects detected
                    </p>
                  </div>
                </div>
                {!isImporting && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={resetState}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>

              {/* Parsed Preview Table */}
              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="size-3.5" />
                      Preview (First {Math.min(5, parsedRows.length)} of {parsedRows.length})
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Auto-mapped
                    </Badge>
                  </div>

                  <div className="rounded-lg border border-border/60 overflow-hidden bg-background">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-border/40 bg-muted/40 font-semibold text-muted-foreground">
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-3">Contact</th>
                          <th className="py-2 px-3">Company</th>
                          <th className="py-2 px-3">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {parsedRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="py-1.5 px-3 font-medium text-foreground">
                              {row.name || "—"}
                            </td>
                            <td className="py-1.5 px-3 text-muted-foreground truncate max-w-[150px]">
                              {row.email || row.phone || "—"}
                            </td>
                            <td className="py-1.5 px-3 text-muted-foreground">
                              {row.company || "—"}
                            </td>
                            <td className="py-1.5 px-3 text-foreground font-mono">
                              {row.deal_value ? `$${row.deal_value.toLocaleString()}` : "$0"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Progress Bar when importing */}
              {isImporting && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Importing prospects...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-3 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              resetState();
              onClose();
            }}
            disabled={isImporting}
            className="text-xs"
          >
            Cancel
          </Button>

          {parsedRows.length > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={handleImport}
              disabled={isImporting || parsedRows.length === 0}
              className="text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-xs"
            >
              {isImporting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Importing ({importProgress}%)...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  Import {parsedRows.length} Leads
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
