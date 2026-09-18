import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * The encryption module reads keys from the environment at call time, so we set
 * env vars before importing/using the functions. We use a dynamic import inside
 * each test group to pick up the current env.
 */

async function loadEncryption() {
  return await import("@/lib/encryption");
}

describe("encryption", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    process.env.CHANNEL_TOKEN_ENCRYPTION_KEY = "primary_test_key_at_least_16_chars_long";
    delete process.env.CHANNEL_TOKEN_ENCRYPTION_KEYS_LEGACY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns null for empty input", async () => {
    const { encrypt, decrypt } = await loadEncryption();
    expect(encrypt(null)).toBeNull();
    expect(encrypt(undefined)).toBeNull();
    expect(encrypt("")).toBeNull();
    expect(decrypt(null)).toBeNull();
    expect(decrypt(undefined)).toBeNull();
  });

  it("round-trips a value with the active key", async () => {
    const { encrypt, decrypt } = await loadEncryption();
    const secret = "super-secret-oauth-token-42";
    const enc = encrypt(secret);
    expect(enc).toBeTruthy();
    expect(enc).not.toBe(secret);
    // Format is iv.tag.ciphertext (three base64url parts)
    expect(String(enc).split(".")).toHaveLength(3);
    expect(decrypt(enc)).toBe(secret);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const { encrypt } = await loadEncryption();
    const a = encrypt("same-value");
    const b = encrypt("same-value");
    expect(a).not.toBe(b);
  });

  it("returns plaintext passthrough for non-encrypted strings", async () => {
    const { decrypt } = await loadEncryption();
    expect(decrypt("just-plain-text")).toBe("just-plain-text");
    expect(decrypt("two.parts")).toBe("two.parts");
  });

  it("decrypts a token after key rotation using a legacy key", async () => {
    // Encrypt with the old key
    process.env.CHANNEL_TOKEN_ENCRYPTION_KEY = "old_rotated_key_at_least_16_chars_long";
    let mod = await loadEncryption();
    const token = "token-before-rotation";
    const enc = mod.encrypt(token);

    // Rotate: new primary key, old key moved to legacy list
    process.env.CHANNEL_TOKEN_ENCRYPTION_KEY = "new_rotated_key_at_least_16_chars_long";
    process.env.CHANNEL_TOKEN_ENCRYPTION_KEYS_LEGACY = "old_rotated_key_at_least_16_chars_long";
    mod = await loadEncryption();

    expect(mod.decrypt(enc)).toBe(token);
  });

  it("cannot decrypt when the key is wrong and no legacy key matches", async () => {
    process.env.CHANNEL_TOKEN_ENCRYPTION_KEY = "keyA_at_least_16_characters_long_value";
    let mod = await loadEncryption();
    const enc = mod.encrypt("data");

    // Different key, no legacy → returns raw ciphertext (cannot decrypt)
    process.env.CHANNEL_TOKEN_ENCRYPTION_KEY = "keyB_completely_different_16_chars_min";
    delete process.env.CHANNEL_TOKEN_ENCRYPTION_KEYS_LEGACY;
    mod = await loadEncryption();

    expect(mod.decrypt(enc)).not.toBe("data");
  });
});
