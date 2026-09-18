-- ============================================================
-- BRAND PRICING PACKAGES TABLE
-- Stores per-brand pricing tiers shown to prospects after they
-- submit the pricing lead-form (Comment → DM → Form → Packages).
--
-- Used by:
--   • GET  /api/brand/pricing-packages         (authenticated CRUD)
--   • POST /api/brand/pricing-packages         (bulk upsert from settings UI)
--   • GET  /api/lead-form/pricing?user={id}    (public, powers the post-submit
--                                               pricing display on /lead-form)
-- ============================================================

CREATE TABLE IF NOT EXISTS brand_pricing_packages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  name            text NOT NULL,                    -- e.g. "Starter", "Growth", "Pro"
  price_display   text NOT NULL,                    -- e.g. "₹15,000/mo" (free-form for locale support)
  price_amount    numeric,                          -- numeric price for CRM deal-value inference
  currency        text DEFAULT 'INR',
  billing_period  text,                             -- e.g. "month", "one-time", "quarter"
  features        jsonb NOT NULL DEFAULT '[]',      -- array of feature strings
  cta_label       text,                             -- optional CTA button override
  is_featured     boolean DEFAULT false,            -- highlight the recommended tier
  display_order   integer DEFAULT 0,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brand_pricing_packages_user_id_idx
  ON brand_pricing_packages (user_id, display_order);

ALTER TABLE brand_pricing_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_pricing_packages_policy ON brand_pricing_packages;
CREATE POLICY brand_pricing_packages_policy ON brand_pricing_packages
  FOR ALL USING (user_id = requesting_user_id())
  WITH CHECK  (user_id = requesting_user_id());

-- Public-read policy: the /lead-form page fetches packages for the brand
-- owner as an unauthenticated visitor. The public read API uses the admin
-- client (service key) to bypass RLS, so no additional policy is required
-- here — RLS still protects direct client-side reads.
