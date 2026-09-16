-- ============================================================================
-- 10 — Channel Page Messaging Credentials
-- ----------------------------------------------------------------------------
-- Instagram & Facebook Direct Messaging (POST /{PAGE_ID}/messages) strictly
-- requires a Facebook PAGE ID + PAGE access token — NOT the Instagram Business
-- Account ID and NOT a user token. Previously only the user token / IG account
-- ID were stored on Instagram channel rows, so DM sends failed with:
--   "The user must be an administrator, editor, or moderator of the page in
--    order to impersonate it" (Meta error #200 impersonation).
--
-- These columns persist the resolved Page credentials on EACH channel row so
-- messaging can use the channel's own Page ID/token deterministically. This
-- works whether Instagram & Facebook are connected as separate accounts (each
-- with its own Page) or share the same underlying Facebook Page.
-- ============================================================================

alter table user_channels add column if not exists page_id text;
alter table user_channels add column if not exists page_access_token text;

comment on column user_channels.page_id is
  'Facebook Page ID backing this channel. Used as the target for the Meta Messaging API (POST /{page_id}/messages).';
comment on column user_channels.page_access_token is
  'Encrypted Facebook Page access token used for sending Instagram/Facebook DMs.';
