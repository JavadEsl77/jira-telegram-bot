import { Bot } from "grammy";

/**
 * یک instance از Bot Telegram ایجاد می‌کند.
 * در صورت نبود `BOT_TOKEN`، بلافاصله خطا می‌دهد (fail-fast).
 */
export function createBot(): Bot {
    const token = process.env.BOT_TOKEN;

    if (!token) {
        throw new Error("BOT_TOKEN is not configured");
    }

    return new Bot(token);
}