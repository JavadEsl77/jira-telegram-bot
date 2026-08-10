import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;

/**
 * قرارداد رمزنگاری Token.
 * این interface امکان جایگزینی پیاده‌سازی رمزنگاری را بدون تغییر Repository فراهم می‌کند.
 */
export interface TokenEncryptionService {
    /**
     * یک مقدار متنی را رمزنگاری می‌کند.
     * @param value - متن خام برای رمزنگاری
     * @returns رشته رمزنگاری‌شده در فرمت `ivHex:authTagHex:ciphertextHex`
     */
    encrypt(value: string): string;

    /**
     * یک مقدار رمزنگاری‌شده را رمزگشایی می‌کند.
     * @param value - رشته رمزنگاری‌شده در فرمت `ivHex:authTagHex:ciphertextHex`
     * @returns متن اصلی
     * @throws اگر فرمت نامعتبر باشد یا احراز هویت رمزنگاری شکست بخورد
     */
    decrypt(value: string): string;
}

/**
 * پیاده‌سازی رمزنگاری با الگوریتم AES-256-GCM.
 * ویژگی‌ها:
 * - IV تصادفی ۱۲ بایتی برای هر رمزنگاری
 * - Authentication Tag برای تضمین یکپارچگی داده
 * - کلید از متغیر محیطی JIRA_TOKEN_ENCRYPTION_KEY (64 کاراکتر hex = 32 بایت)
 *
 * اگر کلید در محیط موجود نباشد، سرویس هنگام ایجاد خطا می‌دهد (fail-fast).
 */
export class AesGcmEncryptionService implements TokenEncryptionService {
    private readonly key: Buffer;

    constructor() {
        const keyHex = process.env.JIRA_TOKEN_ENCRYPTION_KEY;

        if (!keyHex) {
            throw new Error("JIRA_TOKEN_ENCRYPTION_KEY is not configured");
        }

        const keyBuffer = Buffer.from(keyHex, "hex");

        if (keyBuffer.length !== KEY_BYTES) {
            throw new Error(
                "JIRA_TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)",
            );
        }

        this.key = keyBuffer;
    }

    encrypt(value: string): string {
        const iv = crypto.randomBytes(IV_BYTES);
        const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

        const encrypted = Buffer.concat([
            cipher.update(value, "utf8"),
            cipher.final(),
        ]);

        const authTag = cipher.getAuthTag();

        // فرمت ذخیره‌سازی: iv:authTag:ciphertext (همه hex-encoded)
        return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
    }

    decrypt(value: string): string {
        const parts = value.split(":");

        if (parts.length !== 3) {
            throw new Error("Invalid encrypted token format");
        }

        const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];

        const decipher = crypto.createDecipheriv(
            ALGORITHM,
            this.key,
            Buffer.from(ivHex, "hex"),
        );

        decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

        return Buffer.concat([
            decipher.update(Buffer.from(ciphertextHex, "hex")),
            decipher.final(),
        ]).toString("utf8");
    }
}
