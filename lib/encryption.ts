import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

function getEncryptionKey(): string {
    const key = process.env.CHANNEL_TOKEN_ENCRYPTION_KEY;
    if (key && key.trim().length >= 16) {
        return key.trim();
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

const KNOWN_KEYS = [
    process.env.CHANNEL_TOKEN_ENCRYPTION_KEY,
    ...(process.env.NODE_ENV === "development"
        ? [
            "LemonAI_DevOnly_EphemeralKey_ReplaceInProduction_32chars",
            "LemonAISuperSecretTokenEncryptKey",
            "default_token_encryption_key_32chars_lemon"
        ]
        : [])
].filter(Boolean) as string[];

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

    // Try decrypting with verified keys
    for (const keyStr of KNOWN_KEYS) {
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

    console.warn("[Encryption] Could not decrypt token with active keys. Returning raw string.");
    return encrypted;
}