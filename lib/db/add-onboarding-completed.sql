-- ============================================================
-- ADD onboarding_completed FLAG TO brand_profiles TABLE
-- Run this migration against your InsForge Postgres database.
-- This lets us efficiently gate the onboarding wizard for new users.
-- ============================================================

ALTER TABLE brand_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Mark ALL existing rows (users who already filled out brand profile manually)
-- as having completed onboarding so they never see the wizard.
UPDATE brand_profiles
  SET onboarding_completed = true
  WHERE business_name IS NOT NULL AND business_name <> '';
