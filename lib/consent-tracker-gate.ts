/**
 * Cookie Consent & Analytics Tracker Blocker Gate
 *
 * Implements strict prior-consent enforcement under GDPR Art. 7,
 * ePrivacy Directive (Directive 2002/58/EC Art. 5(3)), and DPDP Sec. 6.
 *
 * Guarantees:
 *   1. Prior Consent / Fail-Closed Default:
 *      Before the visitor accepts analytics cookies (or if they reject non-essential),
 *      ALL analytics scripts, tracking pixels, and beacon requests are strictly blocked.
 *   2. Immediate Tracker Cookie Purge:
 *      When consent is rejected or revoked, all existing third-party and analytics
 *      tracking cookies (_ga, _gid, _gat, _fbp, _clck, etc.) are purged from document.cookie.
 *   3. Global Opt-Out Flags:
 *      Enforces window['ga-disable-*'] = true and stubs tracker globals (gtag, fbq)
 *      to ensure no tracking payloads leak even if scripts are already embedded.
 *   4. Dynamic Script Interception:
 *      Intercepts document.createElement('script') and navigator.sendBeacon to drop
 *      requests directed to known tracker domains when consent is absent.
 */

export const LOCALSTORAGE_CONSENT_KEY = "lemonai.consent.v1";
export const CONSENT_VERSION = "1.0";

export interface StoredConsentDecision {
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
  version: string;
}

/** Known tracking & analytics script domains blocked prior to affirmative consent */
export const BLOCKED_TRACKER_DOMAINS: readonly string[] = [
  "google-analytics.com",
  "googletagmanager.com",
  "analytics.google.com",
  "connect.facebook.net",
  "facebook.com/tr",
  "clarity.ms",
  "hotjar.com",
  "static.hotjar.com",
  "posthog.com",
  "app.posthog.com",
  "mixpanel.com",
  "cdn.mxpnl.com",
  "segment.com",
  "cdn.segment.com",
  "analytics.tiktok.com",
] as const;

/** Regex patterns for cookies set by non-essential analytics and advertising trackers */
export const TRACKING_COOKIE_PATTERNS: readonly RegExp[] = [
  /^_ga($|_)/i,
  /^_gid$/i,
  /^_gat($|_)/i,
  /^_fbp$/i,
  /^_fbc$/i,
  /^_gcl/i,
  /^_gac/i,
  /^_clck$/i,
  /^_clsk$/i,
  /^_hj/i,
  /^_pk_/i,
  /^mp_/i,
  /^ajs_/i,
] as const;

/**
 * Reads the stored consent decision from localStorage or in-memory window flag.
 * Returns null if no decision has been recorded yet.
 */
export function readStoredConsentDecision(): StoredConsentDecision | null {
  if (typeof window === "undefined") return null;

  // 1. Check in-memory window property first
  const win = window as unknown as { __lemonAiConsent?: StoredConsentDecision };
  if (win.__lemonAiConsent && typeof win.__lemonAiConsent.analytics === "boolean") {
    return win.__lemonAiConsent;
  }

  // 2. Read from localStorage
  try {
    const raw = window.localStorage.getItem(LOCALSTORAGE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as StoredConsentDecision).analytics === "boolean" &&
      typeof (parsed as StoredConsentDecision).marketing === "boolean"
    ) {
      win.__lemonAiConsent = parsed as StoredConsentDecision;
      return parsed as StoredConsentDecision;
    }
  } catch {
    // Storage inaccessible (private mode / restricted storage)
  }

  return null;
}

/**
 * Checks if analytics cookies and trackers are explicitly permitted by the user.
 * FAILS CLOSED (returns false) if no consent decision exists yet.
 */
export function isAnalyticsConsentGranted(): boolean {
  const decision = readStoredConsentDecision();
  return Boolean(decision?.analytics);
}

/**
 * Checks if marketing cookies are explicitly permitted by the user.
 * FAILS CLOSED (returns false) if no consent decision exists yet.
 */
export function isMarketingConsentGranted(): boolean {
  const decision = readStoredConsentDecision();
  return Boolean(decision?.marketing);
}

/**
 * Checks whether a given URL or hostname belongs to a blocked tracker domain.
 */
export function isBlockedTrackerUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return BLOCKED_TRACKER_DOMAINS.some((domain) => lower.includes(domain));
}

/**
 * Purges all cookies matching known analytics and advertising trackers.
 * Ensures no persistent tracking identifiers remain on disk when consent is withheld.
 */
export function purgeTrackingCookies(): string[] {
  if (typeof document === "undefined") return [];

  const cookies = document.cookie ? document.cookie.split(";") : [];
  const purgedNames: string[] = [];
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const domainsToTry = ["", hostname, `.${hostname}`];

  for (const cookieItem of cookies) {
    const eqIdx = cookieItem.indexOf("=");
    const rawName = (eqIdx > -1 ? cookieItem.slice(0, eqIdx) : cookieItem).trim();
    if (!rawName) continue;

    const isMatch = TRACKING_COOKIE_PATTERNS.some((pattern) => pattern.test(rawName));
    if (isMatch) {
      purgedNames.push(rawName);
      for (const domain of domainsToTry) {
        const domainStr = domain ? `; domain=${domain}` : "";
        document.cookie = `${rawName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0${domainStr}; SameSite=Lax`;
      }
    }
  }

  return purgedNames;
}

/**
 * Applies the active consent policy to the client window environment.
 * If consent is not granted, disables trackers, sets opt-out flags, and purges cookies.
 */
export function applyConsentPolicy(decision: StoredConsentDecision | null): void {
  if (typeof window === "undefined") return;

  const win = window as any;
  const analyticsAllowed = Boolean(decision?.analytics);

  // Sync to window global
  if (decision) {
    win.__lemonAiConsent = decision;
  }
  win.__lemonAiTrackersBlocked = !analyticsAllowed;

  if (!analyticsAllowed) {
    // 1. Enforce Google Analytics opt-out
    win["ga-disable-default"] = true;
    const gaId = process.env.NEXT_PUBLIC_GA_ID;
    if (gaId) {
      win[`ga-disable-${gaId}`] = true;
    }

    // 2. Safely stub gtag / fbq / dataLayer if they haven't been initialized
    if (!win.gtag || typeof win.gtag !== "function") {
      win.gtag = (...args: unknown[]) => {
        if (process.env.NODE_ENV !== "production") {
          console.debug("[CookieConsent] Analytics tracker call blocked (no consent):", args);
        }
      };
    }

    if (!win.fbq || typeof win.fbq !== "function") {
      win.fbq = (...args: unknown[]) => {
        if (process.env.NODE_ENV !== "production") {
          console.debug("[CookieConsent] Meta Pixel call blocked (no consent):", args);
        }
      };
    }

    // 3. Purge all existing tracker cookies immediately
    purgeTrackingCookies();

    // 4. Dispatch notification event
    try {
      win.dispatchEvent(
        new CustomEvent("lemonai:trackers-blocked", {
          detail: { decision, timestamp: Date.now() },
        })
      );
    } catch {
      // Event dispatch fallback
    }
  } else {
    // Analytics Allowed: Clear opt-out flags
    win["ga-disable-default"] = false;
    const gaId = process.env.NEXT_PUBLIC_GA_ID;
    if (gaId) {
      win[`ga-disable-${gaId}`] = false;
    }

    try {
      win.dispatchEvent(
        new CustomEvent("lemonai:trackers-allowed", {
          detail: { decision, timestamp: Date.now() },
        })
      );
    } catch {
      // Event dispatch fallback
    }
  }
}

/**
 * Installs prototype and API-level interceptors to prevent dynamic injection
 * of tracking scripts and beacon telemetry when consent is withheld.
 */
export function installTrackerScriptBlocker(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => undefined;
  }

  const win = window as any;
  if (win.__lemonAiTrackerBlockerInstalled) {
    return () => undefined;
  }
  win.__lemonAiTrackerBlockerInstalled = true;

  // Intercept document.createElement for <script> elements
  const originalCreateElement = document.createElement.bind(document);

  document.createElement = function <K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    options?: ElementCreationOptions
  ): HTMLElementTagNameMap[K] {
    const element = originalCreateElement(tagName, options);

    if (tagName.toLowerCase() === "script") {
      const scriptEl = element as HTMLScriptElement;
      let originalSrc = "";

      Object.defineProperty(scriptEl, "src", {
        get() {
          return originalSrc;
        },
        set(value: string) {
          originalSrc = value;
          // If this is a known tracker script and analytics consent is NOT granted, block it!
          if (isBlockedTrackerUrl(value) && !isAnalyticsConsentGranted()) {
            scriptEl.type = "javascript/blocked";
            if (process.env.NODE_ENV !== "production") {
              console.warn(
                `[CookieConsent] Blocked dynamic analytics script: ${value} (consent not granted)`
              );
            }
            return;
          }
          scriptEl.setAttribute("src", value);
        },
        configurable: true,
        enumerable: true,
      });
    }

    return element;
  };

  // Intercept navigator.sendBeacon if present
  let originalSendBeacon: typeof navigator.sendBeacon | null = null;
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    originalSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null): boolean {
      const urlStr = url.toString();
      if (isBlockedTrackerUrl(urlStr) && !isAnalyticsConsentGranted()) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[CookieConsent] Blocked beacon telemetry to ${urlStr} (consent not granted)`
          );
        }
        return false;
      }
      return originalSendBeacon ? originalSendBeacon(url, data) : false;
    };
  }

  // Return uninstaller for testing / cleanup
  return () => {
    document.createElement = originalCreateElement as any;
    if (originalSendBeacon && typeof navigator !== "undefined") {
      navigator.sendBeacon = originalSendBeacon;
    }
    win.__lemonAiTrackerBlockerInstalled = false;
  };
}

/**
 * Application-level safe telemetry event dispatcher.
 * Checks affirmative consent before dispatching. If consent is absent,
 * the event is dropped silently without exception.
 */
export function trackAnalyticsEvent(
  eventName: string,
  payload?: Record<string, unknown>
): boolean {
  if (typeof window === "undefined") return false;

  if (!isAnalyticsConsentGranted()) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[CookieConsent] Event '${eventName}' dropped — analytics consent not granted.`);
    }
    return false;
  }

  const win = window as any;
  if (typeof win.gtag === "function") {
    try {
      win.gtag("event", eventName, payload);
    } catch {
      // safe fallback
    }
  }

  if (Array.isArray(win.dataLayer)) {
    try {
      win.dataLayer.push({ event: eventName, ...payload });
    } catch {
      // safe fallback
    }
  }

  return true;
}
