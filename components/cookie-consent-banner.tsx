"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * GDPR / ePrivacy / DPDP-compliant cookie consent banner.
 *
 * Behavior:
 *   • On first visit, the banner appears at the bottom of the viewport.
 *   • "Accept all" and "Reject non-essential" both dismiss the banner and
 *     write the decision to localStorage. If the visitor is authenticated,
 *     the decision is ALSO POSTed to /api/user/consent so it lands in the
 *     immutable consent_records table for auditor evidence.
 *   • "Learn more" links to /privacy.
 *   • Once a decision exists in localStorage the banner does not render at
 *     all. Users can revoke consent from /privacy or /settings.
 *   • Essential cookies (session, CSRF, load-balancer stickiness) are always
 *     set — they do not require consent under GDPR Recital 30.
 *
 * The client never blocks scripts by itself — this is a UI + persistence
 * layer. Actual gating of non-essential trackers should read the flag via
 * `window.__lemonAiConsent` before initializing.
 */

import {
  LOCALSTORAGE_CONSENT_KEY,
  CONSENT_VERSION,
  type StoredConsentDecision,
  readStoredConsentDecision,
  applyConsentPolicy,
  installTrackerScriptBlocker,
  purgeTrackingCookies,
} from "@/lib/consent-tracker-gate";

function writeStoredDecision(decision: StoredConsentDecision): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALSTORAGE_CONSENT_KEY, JSON.stringify(decision));
    (
      window as unknown as { __lemonAiConsent?: StoredConsentDecision }
    ).__lemonAiConsent = decision;
  } catch {
    // Storage unavailable (private mode, quota)
  }
}

async function persistDecisionToServer(decision: StoredConsentDecision): Promise<void> {
  const post = (consentType: string, granted: boolean) =>
    fetch("/api/user/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consentType,
        granted,
        version: decision.version,
      }),
      keepalive: true,
    }).catch(() => {
      // Best-effort
    });

  await Promise.all([
    post("analytics_cookies", decision.analytics),
    post("marketing_emails", decision.marketing),
  ]);
}

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return readStoredConsentDecision() === null;
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // 1. Install prototype script & beacon blocker to intercept any dynamically added trackers
    const cleanupBlocker = installTrackerScriptBlocker();

    // 2. Read stored decision. If absent, apply null policy (strict fail-closed prior consent)
    const existing = readStoredConsentDecision();
    applyConsentPolicy(existing);

    return () => {
      cleanupBlocker();
    };
  }, []);

  const decide = async (accept: boolean) => {
    setBusy(true);
    const decision: StoredConsentDecision = {
      analytics: accept,
      marketing: accept,
      timestamp: Date.now(),
      version: CONSENT_VERSION,
    };

    // 1. Persist locally
    writeStoredDecision(decision);

    // 2. Immediately enforce active tracker policy (blocks & purges cookies if false)
    applyConsentPolicy(decision);
    if (!accept) {
      purgeTrackingCookies();
    }

    // 3. Fire-and-forget server sync to immutable consent_records table
    void persistDecisionToServer(decision);

    setVisible(false);
    setBusy(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl rounded-xl border border-border/70 bg-background/95 p-4 shadow-lg backdrop-blur sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <h2
            id="cookie-consent-title"
            className="text-sm font-semibold tracking-tight"
          >
            We use cookies
          </h2>
          <p
            id="cookie-consent-desc"
            className="mt-1 text-xs leading-5 text-muted-foreground"
          >
            Essential cookies keep you signed in. With your consent we also
            use analytics cookies to improve the product and marketing cookies
            to measure campaign performance. You can change this any time on
            the{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Privacy page
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => decide(false)}
            className="rounded-full"
          >
            Reject non-essential
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => decide(true)}
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
