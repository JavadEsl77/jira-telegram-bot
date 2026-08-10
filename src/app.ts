import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

import { createBot } from "./bot/bot.js";
import { registerHandlers } from "./bot/register-handlers.js";
import { ConversationStateManager } from "./bot/conversation-state.js";

import { AesGcmEncryptionService } from "./crypto/token-encryption.js";
import { JiraClientFactory } from "./jira/jira.client.factory.js";

import { DatabaseUserRepository } from "./user/user.repository.database.js";
import { UserService } from "./user/user.service.js";

/**
 * اپلیکیشن را می‌سازد و تمام وابستگی‌ها را به هم وصل می‌کند.
 *
 * ترتیب وابستگی‌ها:
 * 1. Prisma (SQLite از طریق libsql adapter)
 * 2. AesGcmEncryptionService — برای رمزنگاری Token
 * 3. DatabaseUserRepository — ذخیره‌سازی کاربران
 * 4. UserService — منطق تجاری کاربران
 * 5. JiraClientFactory — ساخت JiraClient به‌ازای هر کاربر
 * 6. ConversationStateManager — وضعیت مکالمه Telegram
 * 7. Bot — ثبت handler‌ها و آماده‌سازی برای polling
 *
 * اگر هر متغیر محیطی لازم وجود نداشته باشد، این تابع خطا می‌دهد (fail-fast).
 */
export function createApp() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL is not configured");

    const adapter = new PrismaLibSql({ url: dbUrl });
    const prisma = new PrismaClient({ adapter });

    const encryptionService = new AesGcmEncryptionService();
    const jiraClientFactory = new JiraClientFactory();

    const userRepository = new DatabaseUserRepository(prisma, encryptionService);
    const userService = new UserService(userRepository);

    const stateManager = new ConversationStateManager();

    const bot = createBot();
    registerHandlers(bot, { userService, jiraClientFactory, stateManager });

    return { bot };
}
