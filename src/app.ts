import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

import { createBot } from "./bot/bot.js";
import { registerHandlers } from "./bot/register-handlers.js";
import { ConversationStateManager } from "./bot/conversation-state.js";

import { AesGcmEncryptionService } from "./crypto/token-encryption.js";
import { JiraClientFactory } from "./jira/jira.client.factory.js";

import { DatabaseUserRepository } from "./user/user.repository.database.js";
import { UserService } from "./user/user.service.js";

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
