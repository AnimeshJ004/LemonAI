import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

/**
 * Token encryption for stored OAuth / channel access tokens.
 *
 * Production requires a dedicated CHANNEL_TOKEN_ENCRYPTION_KEY. The key is
 * NEVER derived from other application secrets (Clerk/Supabase), so those can
 * be rotated independently without invalidating stored tokens.
 *
 * Key rotation: to rotate the encryption key, set the new key as
 * CHANNEL_TOKEN_ENCRYPTION_KEY and move the previous key(s) into
 * CHANNEL_TOKEN_ENCRYPTION_KEYS_LEGACY (comma-separated). Decryption will try
 * the active key first, then each legacy key, so already-stored tokens remain
 * readable until they are re-encrypted. No secrets are hardcoded in source.
 */

function getEncryptionKey(): string {
    const key = process.env.CHANNEL_TOKEN_ENCRYPTION_KEY;
    if (key && key.trim().length >= 16) {
        return key.trim();
    }
    // During the build/static-analysis phase return a placeholder so the build
    // does not fail when env vars are not injected. This key is never used to
    // encrypt real data at runtime.
    if (process.env.NEXT_PHASE === "phase-production-build") {
        return "LemonAI_BuildPhase_EphemeralKey_ReplaceInProd_32chars";
    }
    if (process.env.NODE_ENV === "production") {
        throw new Error(
            "[SECURITY FATAL] CHANNEL_TOKEN_ENCRYPTION_KEY must be set in production with at least 16 characters."
        );
    }
    console.warn(
        "[SECURITY WARNING] CHANNEL_TOKEN_ENCRYPTION_KEY is not set. Using ephemeral development key."
    );
    return "LemonAI_DevOnly_EphemeralKey_ReplaceInProduction_32chars";
}

/**
 * Ordered list of keys to attempt during decryption: the active key first,
 * then any legacy keys configured for rotation. Sourced entirely from env —
 * no secrets are embedded in the codebase.
 */
function getDecryptionKeys(): string[] {
    const keys: string[] = [];

    try {
        keys.push(getEncryptionKey());
    } catch {
        // In production with no key configured, decryption cannot proceed.
    }

    const legacy = process.env.CHANNEL_TOKEN_ENCRYPTION_KEYS_LEGACY;
    if (legacy) {
        for (const k of legacy.split(",")) {
            const trimmed = k.trim();
            if (trimmed.length >= 16) keys.push(trimmed);
        }
    }

    // De-duplicate while preserving order.
    return Array.from(new Set(keys));
}

export function encrypt(text: string | null | undefined){
    if(!text) return null
    const iv = randomBytes(12);
    const keyString = getEncryptionKey();
    const encryptionKey = createHash("sha256").update(keyString).digest();
    const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv)

    const encryted = Buffer.concat([
       cipher.update(text, "utf-8"),
       cipher.final()
    ])

    const tag = cipher.getAuthTag()

    const result = [iv.toString("base64url"), tag.toString("base64url"), encryted.toString("base64url")].join(".")
    return result
}

export function decrypt(encrypted: string | null | undefined){
    if(!encrypted) return null;

    const parts = encrypted.split(".")
    if(parts.length !== 3) {
        // Return as is if already plain text
        return encrypted;
    }

    const [iv, tag, encryted] = parts;
    if(!iv || !tag || !encryted) return encrypted;

    // Try the active key, then any configured legacy keys.
    for (const keyStr of getDecryptionKeys()) {
        try {
            const encryptionKey = createHash("sha256").update(keyStr).digest();
            const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(iv, "base64url"));
            decipher.setAuthTag(Buffer.from(tag, "base64url"));

            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(encryted, "base64url")),
                decipher.final()
            ]);
            return decrypted.toString("utf-8");
        } catch {
            // Try next key
            continue;
        }
    }

    console.warn("[Encryption] Could not decrypt token with active or legacy keys. Returning raw string.");
    return encrypted;
}
