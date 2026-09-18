"use client";

/**
 * Brand Pricing Packages Editor
 *
 * Mounted inside the Brand Profile settings page. Lets the user configure
 * the pricing tiers that will be shown to prospects on the public /lead-form
 * page after they submit a pricing enquiry (Comment → DM → Form → Packages).
 *
 * UX: single "edit in place" list with add-row / remove-row and one Save
 * button. On save, the full list is POSTed to /api/brand/pricing-packages
 * which bulk-replaces the user's existing rows.
 */

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Save, Star, IndianRupee, CheckCircle2, AlertCircle } from "lucide-react";

interface EditablePackage {
  _key: string;              // client-side stable key (independent of DB id)
  id?: string;
  name: string;
  price_display: string;
  price_amount: string;       // stored as string in the form for controlled input; parsed on save
  billing_period: string;
  features: string;           // one feature per line (textarea)
  is_featured: boolean;
  display_order: number;
}

function makeKey() {
  return `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function blankPackage(order: number): EditablePackage {
  return {
    _key: makeKey(),
    name: "",
    price_display: "",
    price_amount: "",
    billing_period: "month",
    features: "",
    is_featured: false,
    display_order: order,
  };
}

export function BrandPricingPackages() {
  const [packages, setPackages] = useState<EditablePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Load existing packages once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/brand/pricing-packages", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        const rows: EditablePackage[] = (data?.packages || []).map((p: any, i: number) => ({
          _key: makeKey(),
          id: p.id,
          name: p.name || "",
          price_display: p.price_display || "",
          price_amount: p.price_amount != null ? String(p.price_amount) : "",
          billing_period: p.billing_period || "",
          features: Array.isArray(p.features) ? p.features.join("\n") : "",
          is_featured: Boolean(p.is_featured),
          display_order: typeof p.display_order === "number" ? p.display_order : i,
        }));
        setPackages(rows);
      } catch (err) {
        console.warn("Failed to load pricing packages:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(key: string, field: keyof EditablePackage, value: string | boolean | number) {
    setPackages((prev) =>
      prev.map((p) => (p._key === key ? { ...p, [field]: value } : p))
    );
  }

  function addPackage() {
    setPackages((prev) => [...prev, blankPackage(prev.length)]);
    setStatus(null);
  }

  function removePackage(key: string) {
    setPackages((prev) =>
      prev
        .filter((p) => p._key !== key)
        .map((p, i) => ({ ...p, display_order: i }))
    );
    setStatus(null);
  }

  function move(key: string, direction: -1 | 1) {
    setPackages((prev) => {
      const idx = prev.findIndex((p) => p._key === key);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((p, i) => ({ ...p, display_order: i }));
    });
  }

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      // Client-side validation
      for (const p of packages) {
        if (!p.name.trim() || !p.price_display.trim()) {
          setStatus({
            tone: "error",
            text: "Every package needs a name and a price (e.g. ₹15,000/mo).",
          });
          setSaving(false);
          return;
        }
      }

      const payload = {
        packages: packages.map((p, i) => ({
          name: p.name.trim(),
          price_display: p.price_display.trim(),
          price_amount: p.price_amount ? Number(p.price_amount.replace(/[^0-9.]/g, "")) : null,
          currency: "INR",
          billing_period: p.billing_period.trim() || null,
          features: p.features
            .split("\n")
            .map((f) => f.trim())
            .filter(Boolean),
          is_featured: p.is_featured,
          display_order: i,
          is_active: true,
        })),
      };

      const res = await fetch("/api/brand/pricing-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus({ tone: "error", text: data?.error || "Failed to save packages." });
      } else {
        setStatus({
          tone: "success",
          text: data?.message || "Pricing packages saved.",
        });
      }
    } catch (err: any) {
      setStatus({ tone: "error", text: err?.message || "Network error while saving." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <div className="flex items-center gap-2">
            <IndianRupee className="size-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Pricing Packages</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
            Shown to prospects on the public lead-form after they submit a pricing enquiry from
            Instagram / Facebook DMs. Keep them short — 2 to 4 tiers works best.
          </p>
        </div>
        <button
          type="button"
          onClick={addPackage}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-primary/30 bg-primary/10 text-primary px-3 py-1.5 hover:bg-primary/20 transition-colors"
        >
          <Plus className="size-3.5" /> Add package
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="animate-spin size-5" />
        </div>
      ) : packages.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-muted-foreground/25 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No pricing packages configured yet.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Prospects will see a generic &ldquo;we&apos;ll get back to you&rdquo; screen until you add tiers here.
          </p>
          <button
            type="button"
            onClick={addPackage}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-primary/30 bg-primary/10 text-primary px-3 py-1.5 hover:bg-primary/20 transition-colors"
          >
            <Plus className="size-3.5" /> Add your first package
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {packages.map((p, i) => (
            <div
              key={p._key}
              className="rounded-xl border bg-card/40 p-4 relative"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-[11px] text-muted-foreground font-medium">
                  Package #{i + 1}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(p._key, -1)}
                    disabled={i === 0}
                    className="text-[11px] px-2 py-0.5 rounded border bg-background/50 disabled:opacity-30"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(p._key, 1)}
                    disabled={i === packages.length - 1}
                    className="text-[11px] px-2 py-0.5 rounded border bg-background/50 disabled:opacity-30"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removePackage(p._key)}
                    className="text-[11px] px-2 py-0.5 rounded border border-destructive/30 bg-destructive/10 text-destructive"
                    title="Remove"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Name *</span>
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => updateField(p._key, "name", e.target.value)}
                    placeholder="e.g. Growth"
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Price (display) *
                  </span>
                  <input
                    type="text"
                    value={p.price_display}
                    onChange={(e) => updateField(p._key, "price_display", e.target.value)}
                    placeholder="e.g. ₹15,000/mo"
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Price (numeric, for CRM deal value)
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={p.price_amount}
                    onChange={(e) => updateField(p._key, "price_amount", e.target.value)}
                    placeholder="15000"
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Billing period
                  </span>
                  <input
                    type="text"
                    value={p.billing_period}
                    onChange={(e) => updateField(p._key, "billing_period", e.target.value)}
                    placeholder="e.g. month, quarter, one-time"
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>

                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Features (one per line)
                  </span>
                  <textarea
                    rows={4}
                    value={p.features}
                    onChange={(e) => updateField(p._key, "features", e.target.value)}
                    placeholder={"e.g.\n15 posts / month\n2 reels / month\nWhatsApp support"}
                    className="w-full text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
                  />
                </label>

                <label className="flex items-center gap-2 sm:col-span-2 select-none">
                  <input
                    type="checkbox"
                    checked={p.is_featured}
                    onChange={(e) => updateField(p._key, "is_featured", e.target.checked)}
                    className="size-4"
                  />
                  <span className="text-xs text-foreground flex items-center gap-1">
                    <Star className="size-3.5 text-amber-500" />
                    Mark as recommended tier (highlighted on the lead-form page)
                  </span>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer: Save + status */}
      <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {status ? (
          <div
            className={`flex items-center gap-2 text-xs rounded-lg border px-3 py-2 ${
              status.tone === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {status.tone === "success" ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <AlertCircle className="size-3.5" />
            )}
            {status.text}
          </div>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium px-4 py-2 disabled:opacity-60 hover:bg-primary/90 transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin size-4" /> Saving...
            </>
          ) : (
            <>
              <Save className="size-4" /> Save packages
            </>
          )}
        </button>
      </div>
    </div>
  );
}
