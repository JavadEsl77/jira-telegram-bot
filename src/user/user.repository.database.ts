import { PrismaClient } from "@prisma/client";
import type { User } from "./user.types.js";
import type { UserRepository } from "./user.repository.js";
import type { TokenEncryptionService } from "../crypto/token-encryption.js";

/**
 * پیاده‌سازی پایگاه‌داده‌ای UserRepository با استفاده از Prisma.
 * Token قبل از ذخیره رمزنگاری می‌شود و هنگام خواندن رمزگشایی می‌گردد.
 * telegramId به صورت BigInt ذخیره می‌شود تا از overflow 32-bit جلوگیری شود.
 */
export class DatabaseUserRepository implements UserRepository {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly encryption: TokenEncryptionService,
    ) {}

    /**
     * کاربر را از پایگاه داده بارگذاری می‌کند.
     * اگر کاربر Jira Token داشته باشد، آن را رمزگشایی می‌کند.
     * @param telegramId - شناسه کاربر در Telegram
     * @returns کاربر با Token رمزگشایی‌شده، یا undefined
     */
    async findByTelegramId(telegramId: number): Promise<User | undefined> {
        const record = await this.prisma.user.findUnique({
            where: { telegramId: BigInt(telegramId) },
        });

        if (!record) return undefined;

        const jira =
            record.jiraUsername && record.jiraToken
                ? {
                      username: record.jiraUsername,
                      displayName: record.jiraDisplayName ?? undefined,
                      accountId: record.jiraAccountId ?? undefined,
                      token: this.encryption.decrypt(record.jiraToken),
                  }
                : undefined;

        return {
            telegramId,
            jira,
            taskPageSize: record.taskPageSize,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }

    /**
     * کاربر را در پایگاه داده ذخیره یا به‌روز می‌کند (upsert).
     * اگر jira موجود باشد، Token را قبل از ذخیره رمزنگاری می‌کند.
     * @param user - داده‌های کاربر — Token باید خام (رمزنگاری‌نشده) باشد
     */
    async save(user: User): Promise<void> {
        const jiraData = user.jira
            ? {
                  jiraUsername: user.jira.username,
                  jiraDisplayName: user.jira.displayName ?? null,
                  jiraAccountId: user.jira.accountId ?? null,
                  jiraToken: this.encryption.encrypt(user.jira.token),
              }
            : {
                  jiraUsername: null,
                  jiraDisplayName: null,
                  jiraAccountId: null,
                  jiraToken: null,
              };

        await this.prisma.user.upsert({
            where: { telegramId: BigInt(user.telegramId) },
            update: { ...jiraData, taskPageSize: user.taskPageSize },
            create: {
                telegramId: BigInt(user.telegramId),
                ...jiraData,
                taskPageSize: user.taskPageSize,
            },
        });
    }
}
