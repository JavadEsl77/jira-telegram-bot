import { PrismaClient } from "@prisma/client";
import type { User } from "./user.types.js";
import type { UserRepository } from "./user.repository.js";
import type { TokenEncryptionService } from "../crypto/token-encryption.js";

export class DatabaseUserRepository implements UserRepository {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly encryption: TokenEncryptionService,
    ) {}

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
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }

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
            update: { ...jiraData },
            create: {
                telegramId: BigInt(user.telegramId),
                ...jiraData,
            },
        });
    }
}
