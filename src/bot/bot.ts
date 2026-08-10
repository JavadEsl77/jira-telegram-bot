import { Bot } from "grammy";

export function createBot(): Bot {
    const token = process.env.BOT_TOKEN;

    if (!token) {
        throw new Error("BOT_TOKEN is not configured");
    }

    return new Bot(token);
}