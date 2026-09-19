import Link from "next/link";
import Logo from "@/components/logo";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Privacy Policy · Lemon AI",
  description:
    "How Lemon AI collects, uses, stores, and deletes your personal data. GDPR + DPDP + CCPA compliance summary.",
};

const PRIVACY_CONTACT =
  process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() ||
  "privacy@example.invalid";
const PRIVACY_CONTACT_IS_PLACEHOLDER =
  !process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL ||
  process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL.trim().endsWith(".invalid") ||
  process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL.trim().endsWith(".example");

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Last updated: 18 September 2026 · Version 1.0
        </p>

        <div className="mt-10 space-y-10 text-[15px] leading-7 text-foreground/90">
          <section>
            <h2 className="text-2xl font-semibold tracking-tight">Summary</h2>
            <p className="mt-3">
              Lemon AI is an AI-powered marketing suite. We collect only the data
              we need to run the service you signed up for: your account
              identity (via Clerk), the social channels you connect, the posts
              you draft, the leads you receive, and the AI content you generate.
              We never sell your data. Every OAuth token is encrypted with
              AES-256-GCM at rest. You can export or permanently delete
              everything at any time from your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              1. What we collect
            </h2>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>
                <strong>Identity</strong> — email, name, avatar (handled by
                Clerk).
              </li>
              <li>
                <strong>Business profile</strong> — company name, niche, tone,
                target audience.
              </li>
              <li>
                <strong>Connected channels</strong> — OAuth tokens for each
                social platform you link. Tokens are AES-256-GCM encrypted.
              </li>
              <li>
                <strong>Content you create</strong> — scheduled posts, ideas,
                AI-generated captions, images, and reels.
              </li>
              <li>
                <strong>Leads and conversations</strong> — CRM entries,
                Instagram / Facebook / WhatsApp / website chat messages routed
                to your workspace.
              </li>
              <li>
                <strong>Consent and audit trail</strong> — records of your
                privacy choices and security-relevant events, retained for
                six years for legal defense.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              2. How we use it
            </h2>
            <p className="mt-3">
              Strictly to operate the service: generate content, publish posts,
              route incoming messages to your CRM, run the AI flywheel, and
              show you analytics. We use LLM providers (Groq) for content
              generation — your prompts are transient and never used to train
              third-party models.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              3. Retention
            </h2>
            <p className="mt-3">
              Data lives only as long as it is useful:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>Audit logs and consent history: 6 years.</li>
              <li>CRM messages: 2 years.</li>
              <li>AI memory: 2 years.</li>
              <li>Public comments log: 1 year.</li>
              <li>Comment-reply idempotency ledger: 30 days.</li>
              <li>All content: until you delete it or your account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              4. Your rights
            </h2>
            <p className="mt-3">
              Under GDPR (EU/UK), the DPDP Act 2023 (India), and CCPA
              (California) you can:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>
                <strong>Access</strong> — download a full JSON export of your
                data at any time.
              </li>
              <li>
                <strong>Delete</strong> — erase your account and every row we
                hold about you.
              </li>
              <li>
                <strong>Correct</strong> — update inaccurate information
                yourself in the app or by contacting us.
              </li>
              <li>
                <strong>Withdraw consent</strong> — revoke marketing,
                analytics, or AI-training consent at any time.
              </li>
              <li>
                <strong>Object</strong> — object to any specific processing by
                contacting our privacy team.
              </li>
            </ul>
            <p className="mt-4">
              Self-service endpoints:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6 font-mono text-sm">
              <li>
                <code>GET /api/user/data-export</code> — full JSON export
              </li>
              <li>
                <code>DELETE /api/user/delete-account</code> — permanent erasure
              </li>
              <li>
                <code>GET /api/user/consent</code> — view consent state
              </li>
              <li>
                <code>POST /api/user/consent</code> — grant / revoke consent
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              5. Security
            </h2>
            <p className="mt-3">
              TLS in transit. AES-256-GCM at rest for OAuth tokens (with key
              rotation support). Row-Level Security on every user-scoped
              database table. Server logs are automatically scrubbed for
              email, phone, tokens, API keys, JWTs, credit-card-shaped
              sequences, and IP addresses before they reach any log sink.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              6. Sub-processors
            </h2>
            <p className="mt-3">
              Clerk (auth), Supabase / Insforge (database + storage), Vercel
              (hosting), Inngest (background jobs), Groq (LLM inference), and
              the social platforms you connect (Meta, LinkedIn, X, YouTube,
              Bluesky, Threads). We only share the minimum data each
              vendor needs to perform its function.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">
              7. Contact
            </h2>
            <p className="mt-3">
              Privacy questions, DSR requests, or breach reports:{" "}
              <a
                href={`mailto:${PRIVACY_CONTACT}`}
                className="font-medium underline underline-offset-4"
              >
                {PRIVACY_CONTACT}
              </a>
              . We respond within 30 days as required by GDPR Art. 12(3).
            </p>
            {PRIVACY_CONTACT_IS_PLACEHOLDER && process.env.NODE_ENV !== "production" && (
              <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <strong>Configuration warning:</strong>{" "}
                <code>NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL</code> is unset or still
                points at a placeholder domain. Set it to a monitored mailbox
                (e.g. <code>privacy@your-company.com</code>) in your deployment
                environment before going live — GDPR Art. 12(3) requires a
                working contact route.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-border/60 bg-card p-6">
            <p className="text-sm text-muted-foreground">
              For the full engineering-facing compliance document (data map,
              retention matrix, breach playbook), see{" "}
              <Link
                href="https://github.com/"
                className="font-medium text-foreground underline underline-offset-4"
              >
                PRIVACY.md
              </Link>{" "}
              in the repository.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Lemon AI. Made with ❤ for autonomous
        marketing.
      </footer>
    </div>
  );
}
