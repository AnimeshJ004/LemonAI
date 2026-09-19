import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  LOCALSTORAGE_CONSENT_KEY,
  isAnalyticsConsentGranted,
  isMarketingConsentGranted,
  isBlockedTrackerUrl,
  purgeTrackingCookies,
  applyConsentPolicy,
  installTrackerScriptBlocker,
  trackAnalyticsEvent,
  TRACKING_COOKIE_PATTERNS,
} from "@/lib/consent-tracker-gate";

describe("Cookie Consent & Analytics Tracker Blocker Gate", () => {
  let mockStorage: Record<string, string> = {};
  let mockCookieStr = "";
  let eventListeners: Record<string, Array<(e: any) => void>> = {};
  let originalWindow: any;
  let originalDocument: any;
  let originalCustomEvent: any;

  beforeEach(() => {
    mockStorage = {};
    mockCookieStr = "";
    eventListeners = {};

    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;
    originalCustomEvent = (globalThis as any).CustomEvent;

    // Browser Window Mock
    const mockWin: any = {
      localStorage: {
        getItem: (key: string) => mockStorage[key] ?? null,
        setItem: (key: string, value: string) => {
          mockStorage[key] = value;
        },
        removeItem: (key: string) => {
          delete mockStorage[key];
        },
        clear: () => {
          mockStorage = {};
        },
      },
      location: { hostname: "lemonai.app" },
      addEventListener: (event: string, handler: (e: any) => void) => {
        eventListeners[event] = eventListeners[event] || [];
        eventListeners[event].push(handler);
      },
      removeEventListener: (event: string, handler: (e: any) => void) => {
        if (eventListeners[event]) {
          eventListeners[event] = eventListeners[event].filter((h) => h !== handler);
        }
      },
      dispatchEvent: (event: any) => {
        const handlers = eventListeners[event.type] || [];
        for (const h of handlers) h(event);
        return true;
      },
    };

    // Browser Document Mock
    const mockDoc: any = {
      get cookie() {
        return mockCookieStr;
      },
      set cookie(val: string) {
        if (val.includes("max-age=0") || val.includes("expires=Thu, 01 Jan 1970")) {
          const cookieName = val.split("=")[0].trim();
          const remaining = mockCookieStr
            .split(";")
            .map((c) => c.trim())
            .filter((c) => c.length > 0 && c.split("=")[0].trim() !== cookieName);
          mockCookieStr = remaining.join("; ");
        } else {
          const pair = val.split(";")[0].trim();
          const name = pair.split("=")[0].trim();
          const existing = mockCookieStr
            .split(";")
            .map((c) => c.trim())
            .filter((c) => c.length > 0 && c.split("=")[0].trim() !== name);
          mockCookieStr = existing.length > 0 ? `${existing.join("; ")}; ${pair}` : pair;
        }
      },
      createElement: (tag: string) => {
        const el: any = {
          tagName: tag.toUpperCase(),
          type: "text/javascript",
          attributes: {} as Record<string, string>,
          setAttribute: (k: string, v: string) => {
            el.attributes[k] = v;
          },
          getAttribute: (k: string) => el.attributes[k] ?? null,
        };
        return el;
      },
    };

    class MockCustomEvent {
      type: string;
      detail: any;
      constructor(type: string, options?: { detail?: any }) {
        this.type = type;
        this.detail = options?.detail;
      }
    }

    (globalThis as any).window = mockWin;
    (globalThis as any).document = mockDoc;
    (globalThis as any).CustomEvent = MockCustomEvent;
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).CustomEvent = originalCustomEvent;
    vi.restoreAllMocks();
  });

  describe("Prior Consent & Default Fail-Closed State", () => {
    it("returns false for analytics and marketing consent when no record is stored", () => {
      expect(isAnalyticsConsentGranted()).toBe(false);
      expect(isMarketingConsentGranted()).toBe(false);
    });

    it("returns false when user rejects non-essential cookies", () => {
      mockStorage[LOCALSTORAGE_CONSENT_KEY] = JSON.stringify({
        analytics: false,
        marketing: false,
        timestamp: Date.now(),
        version: "1.0",
      });

      expect(isAnalyticsConsentGranted()).toBe(false);
      expect(isMarketingConsentGranted()).toBe(false);
    });

    it("returns true when user accepts all cookies", () => {
      mockStorage[LOCALSTORAGE_CONSENT_KEY] = JSON.stringify({
        analytics: true,
        marketing: true,
        timestamp: Date.now(),
        version: "1.0",
      });

      expect(isAnalyticsConsentGranted()).toBe(true);
      expect(isMarketingConsentGranted()).toBe(true);
    });
  });

  describe("Tracker Domain & Script Matching", () => {
    it("identifies Google Analytics and Google Tag Manager URLs as blocked trackers", () => {
      expect(isBlockedTrackerUrl("https://www.google-analytics.com/analytics.js")).toBe(true);
      expect(isBlockedTrackerUrl("https://www.googletagmanager.com/gtag/js?id=G-12345")).toBe(true);
      expect(isBlockedTrackerUrl("https://analytics.google.com/g/collect")).toBe(true);
    });

    it("identifies Meta Pixel, TikTok, PostHog, Hotjar, and Clarity as blocked trackers", () => {
      expect(isBlockedTrackerUrl("https://connect.facebook.net/en_US/fbevents.js")).toBe(true);
      expect(isBlockedTrackerUrl("https://www.facebook.com/tr?id=123&ev=PageView")).toBe(true);
      expect(isBlockedTrackerUrl("https://analytics.tiktok.com/i18n/pixel/events.js")).toBe(true);
      expect(isBlockedTrackerUrl("https://app.posthog.com/static/array.js")).toBe(true);
      expect(isBlockedTrackerUrl("https://static.hotjar.com/c/hotjar-123.js")).toBe(true);
      expect(isBlockedTrackerUrl("https://www.clarity.ms/tag/xyz123")).toBe(true);
    });

    it("allows first-party application routes and benign third-party assets", () => {
      expect(isBlockedTrackerUrl("/api/analytics/overview")).toBe(false);
      expect(isBlockedTrackerUrl("https://lemonai.app/dashboard")).toBe(false);
      expect(isBlockedTrackerUrl("https://fonts.googleapis.com/css2?family=Inter")).toBe(false);
      expect(isBlockedTrackerUrl("https://images.unsplash.com/photo-123")).toBe(false);
    });
  });

  describe("Tracking Cookie Purging", () => {
    it("matches all standard analytics & advertising cookie prefixes", () => {
      const sampleCookies = [
        "_ga",
        "_ga_ABC123",
        "_gid",
        "_gat",
        "_fbp",
        "_fbc",
        "_clck",
        "_clsk",
        "_hjSessionUser",
        "_pk_id.1.5",
        "mp_abc_mixpanel",
        "ajs_user_id",
      ];

      for (const cookie of sampleCookies) {
        const matches = TRACKING_COOKIE_PATTERNS.some((pat) => pat.test(cookie));
        expect(matches).toBe(true);
      }
    });

    it("does not match essential session, auth, or application cookies", () => {
      const essentialCookies = [
        "__session",
        "__clerk_db_jwt",
        "lemon_ai_onboarded_user_1",
        "lemonai_sidebar_state",
        "csrftoken",
      ];

      for (const cookie of essentialCookies) {
        const matches = TRACKING_COOKIE_PATTERNS.some((pat) => pat.test(cookie));
        expect(matches).toBe(false);
      }
    });

    it("purges tracker cookies from document.cookie", () => {
      document.cookie = "_ga=GA1.2.123456; path=/";
      document.cookie = "_fbp=fb.1.123456; path=/";
      document.cookie = "__session=essential_auth_token; path=/";

      const purged = purgeTrackingCookies();
      expect(purged).toContain("_ga");
      expect(purged).toContain("_fbp");
      expect(purged).not.toContain("__session");
      expect(document.cookie).toContain("__session");
      expect(document.cookie).not.toContain("_ga");
      expect(document.cookie).not.toContain("_fbp");
    });
  });

  describe("Consent Policy Enforcement", () => {
    it("sets ga-disable flags, marks trackers blocked, and stubs globals when consent is rejected", () => {
      applyConsentPolicy({
        analytics: false,
        marketing: false,
        timestamp: Date.now(),
        version: "1.0",
      });

      expect((window as any).__lemonAiTrackersBlocked).toBe(true);
      expect((window as any)["ga-disable-default"]).toBe(true);
      expect(typeof (window as any).gtag).toBe("function");
      expect(typeof (window as any).fbq).toBe("function");
    });

    it("unsets ga-disable flags and marks trackers allowed when consent is granted", () => {
      applyConsentPolicy({
        analytics: true,
        marketing: true,
        timestamp: Date.now(),
        version: "1.0",
      });

      expect((window as any).__lemonAiTrackersBlocked).toBe(false);
      expect((window as any)["ga-disable-default"]).toBe(false);
    });

    it("dispatches custom events when policy is applied", () => {
      const eventSpy = vi.fn();
      window.addEventListener("lemonai:trackers-blocked", eventSpy);

      applyConsentPolicy(null); // null means no consent -> blocked

      expect(eventSpy).toHaveBeenCalled();
      window.removeEventListener("lemonai:trackers-blocked", eventSpy);
    });
  });

  describe("Dynamic Script Interception Gate", () => {
    it("blocks dynamic script tags attempting to load tracking domains when consent is withheld", () => {
      const cleanup = installTrackerScriptBlocker();

      // No consent granted
      mockStorage[LOCALSTORAGE_CONSENT_KEY] = JSON.stringify({
        analytics: false,
        marketing: false,
        timestamp: Date.now(),
        version: "1.0",
      });

      const script = document.createElement("script");
      script.src = "https://www.google-analytics.com/analytics.js";

      // Script type should be neutralized to blocked
      expect(script.type).toBe("javascript/blocked");

      cleanup();
    });

    it("allows non-tracking scripts to load normally", () => {
      const cleanup = installTrackerScriptBlocker();

      const script = document.createElement("script");
      script.src = "https://cdn.example.com/app.js";

      expect(script.type).not.toBe("javascript/blocked");
      expect(script.getAttribute("src")).toBe("https://cdn.example.com/app.js");

      cleanup();
    });

    it("allows tracker scripts when analytics consent is explicitly granted", () => {
      const cleanup = installTrackerScriptBlocker();

      mockStorage[LOCALSTORAGE_CONSENT_KEY] = JSON.stringify({
        analytics: true,
        marketing: true,
        timestamp: Date.now(),
        version: "1.0",
      });

      const script = document.createElement("script");
      script.src = "https://www.google-analytics.com/analytics.js";

      expect(script.type).not.toBe("javascript/blocked");

      cleanup();
    });
  });

  describe("Safe Analytics Event Dispatcher (trackAnalyticsEvent)", () => {
    it("drops events when analytics consent is not granted", () => {
      const gtagSpy = vi.fn();
      (window as any).gtag = gtagSpy;

      mockStorage[LOCALSTORAGE_CONSENT_KEY] = JSON.stringify({
        analytics: false,
        marketing: false,
        timestamp: Date.now(),
        version: "1.0",
      });

      const dispatched = trackAnalyticsEvent("button_click", { button_id: "cta_1" });
      expect(dispatched).toBe(false);
      expect(gtagSpy).not.toHaveBeenCalled();
    });

    it("forwards events to gtag when analytics consent is granted", () => {
      const gtagSpy = vi.fn();
      (window as any).gtag = gtagSpy;

      mockStorage[LOCALSTORAGE_CONSENT_KEY] = JSON.stringify({
        analytics: true,
        marketing: true,
        timestamp: Date.now(),
        version: "1.0",
      });

      const dispatched = trackAnalyticsEvent("conversion_lead_created", { lead_id: "lead_99" });
      expect(dispatched).toBe(true);
      expect(gtagSpy).toHaveBeenCalledWith("event", "conversion_lead_created", {
        lead_id: "lead_99",
      });
    });
  });
});
