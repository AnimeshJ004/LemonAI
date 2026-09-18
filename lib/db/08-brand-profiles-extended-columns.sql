-- ============================================================
-- BRAND PROFILES — EXTENDED COLUMNS MIGRATION
--
-- The original brand_profiles schema (see create-brand-profiles-and-meta-ads-tables.sql)
-- only defines 6 core columns: business_name, niche, target_audience, brand_tone,
-- main_offer, competitors.
--
-- The Brand Profile form and /api/brand POST endpoint collect several additional
-- fields (Products & Services Catalog, Pricing Structure & Guarantee, Brand
-- Knowledge Base, Location, Booking URL, plus voice/WhatsApp automation
-- settings). Without matching columns, the API's extended-columns update
-- silently fails inside a try/catch and the data never persists.
--
-- This migration adds every extended column using ADD COLUMN IF NOT EXISTS
-- so it is safe to re-run on any environment.
-- ============================================================

ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS products_services      text;
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS pricing_details        text;
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS knowledge_docs         text;
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS location               text;
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS booking_url            text;
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS auto_call_enabled      boolean DEFAULT false;
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS auto_call_min_score    integer DEFAULT 7;
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id text;
