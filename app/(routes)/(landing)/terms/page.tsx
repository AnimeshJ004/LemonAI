import Link from "next/link";
import Logo from "@/components/logo";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Terms of Service · Lemon AI",
  description:
    "The legal contract between you and Lemon AI. Acceptable use, subscription terms, liability, and termination.",
};

// Same env-driven contact address as the privacy page so operators only set
// one variable. See NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL in .env.example.
const LEGAL_CONTACT =
  process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() ||
  "legal@example.invalid";
const LEGAL_CONTACT_IS_PLACEHOLDER =
  !process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL ||
  process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL.trim().endsWith(".invalid") ||
  process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL.trim().endsWith(".example");

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="shrink-0">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link href="/sign-in">Log in</Link>
            </Button>
            <Button
              asChild
              className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90"
            >
              <Link href="/sign-up">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Legal
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Last updated: 19 September 2026 · Version 1.0
        </p>

        <div className="mt-10 space-y-10 text-[15px] leading-7 text-foreground/90">
          <section>
            <h2 className="text-2xl font-semibold tracking-tight">Summary</h2>
            <p className="mt-3">
              These Terms of Service (&quot;<strong>Terms</strong>&quot;) form a binding
              contract between you (&quot;<strong>you</strong>&quot;, &quot;<strong>Customer</strong>&quot;) and Lemon
              AI (&quot;<strong>we</strong>&quot;, &quot;<strong>us</strong>&quot;). By creating an
              account or using the service you agree to be bound by them. If
              you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              1. The Service
            </h2>
            <p className="mt-3">
              Lemon AI is an AI-powered marketing automation platform that
              connects to your social channels, generates content, publishes
              on your behalf, captures leads, and provides a CRM. Features
              described on the marketing site are targets, not guarantees;
              specific capabilities available to your account depend on your
              subscription tier and connected integrations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              2. Account &amp; Eligibility
            </h2>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>You must be at least 18 years old and legally capable of entering into a contract.</li>
              <li>You are responsible for the accuracy of the information you provide and for keeping your credentials secure.</li>
              <li>Authentication is handled by Clerk (see our Privacy Policy). We do not store your password.</li>
              <li>You must not share a single account with multiple people; each seat represents one authorised user.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              3. Acceptable Use
            </h2>
            <p className="mt-3">You will not, and will not allow anyone to:</p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>use the service to generate or publish unlawful, defamatory, harassing, or infringing content;</li>
              <li>send spam, phishing, deceptive advertising, or any communication that violates CAN-SPAM, TCPA, GDPR ePrivacy, DPDP, or platform-specific rules of Meta / LinkedIn / X / YouTube / Bluesky / Threads;</li>
              <li>circumvent rate limits, scrape at scale, or use the platform to build a competing product;</li>
              <li>upload malware or attempt to gain unauthorised access to any part of the service;</li>
              <li>publish content that sexualises minors, promotes self-harm, incites violence, or facilitates discrimination.</li>
            </ul>
            <p className="mt-3">
              We may suspend or terminate your account for any material breach
              of this section, effective immediately and without refund.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              4. Third-Party Platforms
            </h2>
            <p className="mt-3">
              When you connect a social channel (Instagram, Facebook,
              LinkedIn, X, YouTube, Threads, Bluesky, WhatsApp, etc.),
              your use of that channel remains governed by the third party&apos;s
              own terms. Lemon AI is not responsible for content moderation
              decisions, rate-limit enforcement, or availability of those
              platforms. If a platform revokes access, some Lemon AI features
              will stop working for your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              5. AI-Generated Content
            </h2>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>AI outputs (posts, captions, images, reels, ad copy, voice scripts) are generated on your instructions using third-party model providers (Groq, Replicate, Cloudflare AI). We do not guarantee accuracy, originality, non-infringement, or fitness for a particular purpose.</li>
              <li>You are solely responsible for reviewing AI outputs before publishing them and for ensuring they comply with applicable law and platform rules.</li>
              <li>You grant Lemon AI a limited licence to process your inputs (business profile, brand knowledge, connected channel content) to generate outputs and to improve model routing decisions in an aggregated, non-identifying way.</li>
              <li>We do not use your data to train third-party foundation models. If a model provider&apos;s policy changes, we will disclose it and give you the option to opt out.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              6. Subscription, Billing &amp; Cancellation
            </h2>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>Paid plans are billed in advance on a recurring basis (monthly or annual) via our billing partner. Prices are shown in your account and may change with 30 days&apos; notice.</li>
              <li>All fees are non-refundable except where required by law. You can cancel at any time; cancellation takes effect at the end of the current billing period.</li>
              <li>Usage that exceeds your plan&apos;s AI quota, publish volume, or seat limits may incur overage fees, be rate-limited, or trigger an automatic plan upgrade prompt.</li>
              <li>Failure to pay may result in suspension. Extended non-payment (30+ days) may result in permanent account deletion; you remain able to export your data via the DSR endpoints described in the Privacy Policy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              7. Your Content &amp; Data
            </h2>
            <p className="mt-3">
              You retain ownership of everything you put into the service —
              your brand profile, drafts, uploaded media, lead lists, and CRM
              records. You grant Lemon AI the minimum licence necessary to
              store, process, transmit, and display that content in order to
              operate the service. Deletion is handled by the DSR endpoints in
              the Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              8. Uptime &amp; Support
            </h2>
            <p className="mt-3">
              We target 99.5% availability measured over a rolling 28-day
              window, as described in our public operations runbook. This is a
              target, not a legal warranty. Best-effort support is provided by
              email at{" "}
              <a
                href={`mailto:${LEGAL_CONTACT}`}
                className="font-medium underline underline-offset-4"
              >
                {LEGAL_CONTACT}
              </a>
              . Priority support terms, if applicable, are set out in your
              order form.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              9. Warranty Disclaimer
            </h2>
            <p className="mt-3">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;. TO THE
              MAXIMUM EXTENT PERMITTED BY LAW WE DISCLAIM ALL WARRANTIES,
              WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
              NON-INFRINGEMENT.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              10. Limitation of Liability
            </h2>
            <p className="mt-3">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY IS LIABLE
              FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
              PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR
              GOODWILL, ARISING OUT OF OR IN CONNECTION WITH THESE TERMS.
              OUR AGGREGATE LIABILITY FOR ALL CLAIMS IN ANY 12-MONTH PERIOD
              IS CAPPED AT THE FEES YOU PAID US IN THAT PERIOD.
            </p>
            <p className="mt-3">
              Nothing in these Terms limits liability that cannot be limited
              by law (e.g. fraud, gross negligence, or statutory consumer
              rights).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              11. Indemnity
            </h2>
            <p className="mt-3">
              You will indemnify us against third-party claims arising from
              content you publish through the service, your violation of
              these Terms, or your infringement of a third party&apos;s rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              12. Termination
            </h2>
            <p className="mt-3">
              You may terminate at any time by deleting your account from the
              settings page. We may terminate for material breach or extended
              non-payment on written notice. Upon termination we will delete
              your data in accordance with the Privacy Policy retention
              schedule.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              13. Changes
            </h2>
            <p className="mt-3">
              We may update these Terms from time to time. Material changes
              will be announced at least 30 days in advance via email or
              in-app notice. Continued use after the effective date
              constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              14. Governing Law &amp; Disputes
            </h2>
            <p className="mt-3">
              These Terms are governed by the laws of the jurisdiction listed
              in your order form or, if none, by the laws of the state or
              country where Lemon AI is incorporated. Disputes will first be
              attempted to be resolved amicably by written notice to the
              contact address below. If unresolved after 30 days, disputes
              will be finally resolved in the courts of that jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              15. Contact
            </h2>
            <p className="mt-3">
              Questions about these Terms:{" "}
              <a
                href={`mailto:${LEGAL_CONTACT}`}
                className="font-medium underline underline-offset-4"
              >
                {LEGAL_CONTACT}
              </a>
              .
            </p>
            {LEGAL_CONTACT_IS_PLACEHOLDER && process.env.NODE_ENV !== "production" && (
              <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <strong>Configuration warning:</strong>{" "}
                <code>NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL</code> is unset or
                still points at a placeholder domain. Set it to a monitored
                mailbox in your deployment environment before going live.
              </p>
            )}
          </section>
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-3 border-t border-border/60 pt-8">
          <Link
            href="/privacy"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            View Privacy Policy →
          </Link>
          <span className="text-sm text-muted-foreground">·</span>
          <Link
            href="/sign-up"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Create an account
          </Link>
        </div>
      </main>
    </div>
  );
}
