"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Layers, ArrowRight } from "lucide-react";
import { ChannelTypeEnum, getChannelIcon } from "@/constants/channels";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";

interface PendingAccount {
  providerAccountId: string;
  handle: string;
  profileImage?: string | null;
  pageName: string;
  pageId?: string | null;
}

export function SelectAccountDialog() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const isOpen = searchParams.get("select_account") === "instagram";
  const [accounts, setAccounts] = useState<PendingAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    fetch("/api/channel/pending-accounts")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.accounts && data.accounts.length > 0) {
          setAccounts(data.accounts);
        } else {
          toast.error("No pending accounts found or session expired. Please re-connect.");
          closeDialog();
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Failed to load pending accounts:", err);
        toast.error("Failed to retrieve accounts. Please try again.");
        closeDialog();
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const closeDialog = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("select_account");
    url.searchParams.delete("channelTypeId");
    router.replace(url.pathname + (url.search ? url.search : ""));
  };

  const handleSelect = async (account: PendingAccount) => {
    setSelectingId(account.providerAccountId);
    try {
      const res = await fetch("/api/channel/select-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerAccountId: account.providerAccountId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to connect account");
      }

      toast.success(`Successfully connected ${data.handle || account.handle}!`);
      await queryClient.invalidateQueries({ queryKey: ["channels"] });
      closeDialog();
    } catch (err: any) {
      console.error("Selection error:", err);
      toast.error(err.message || "Failed to select account");
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden shadow-2xl border-border/80">
        <DialogHeader className="px-6 py-5 border-b bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-sm shrink-0">
              {getChannelIcon(ChannelTypeEnum.INSTAGRAM) ? (
                <HugeiconsIcon icon={getChannelIcon(ChannelTypeEnum.INSTAGRAM)!} className="size-5 text-white" />
              ) : (
                <CheckCircle2 className="size-5 text-white" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Select Instagram Account
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Multiple accounts detected. Which account do you want to manage with Lemon AI?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs">
              <Spinner className="size-6 text-primary" />
              <span>Scanning discovered Instagram accounts...</span>
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground space-y-3">
              <p>No eligible Instagram accounts found in this session.</p>
              <Button size="sm" variant="outline" onClick={closeDialog}>
                Close
              </Button>
            </div>
          ) : (
            accounts.map((acc) => {
              const isChosen = selectingId === acc.providerAccountId;
              return (
                <div
                  key={acc.providerAccountId}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 hover:border-primary/40 bg-card hover:bg-muted/30 transition-all gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative size-11 rounded-full ring-2 ring-primary/20 overflow-hidden shrink-0 bg-muted flex items-center justify-center font-bold text-xs text-muted-foreground">
                      {acc.profileImage ? (
                        <Image
                          src={acc.profileImage}
                          alt={acc.handle}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        acc.handle.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate flex items-center gap-1.5 text-foreground">
                        <span>{acc.handle}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate mt-0.5">
                        <Layers className="size-3 shrink-0" />
                        <span className="truncate">{acc.pageName}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    disabled={Boolean(selectingId)}
                    onClick={() => handleSelect(acc)}
                    className="shrink-0 h-8 px-3.5 text-xs font-semibold gap-1.5"
                  >
                    {isChosen ? (
                      <>
                        <Spinner className="size-3" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <span>Connect</span>
                        <ArrowRight className="size-3" />
                      </>
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
