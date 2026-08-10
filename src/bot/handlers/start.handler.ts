import type { Bot } from "grammy";

import type { UserService } from "../../user/user.service.js";
import { mainKeyboard } from "../keyboards/main.keyboard.js";
import { connectJiraKeyboard } from "../keyboards/connect-jira.keyboard.js";

export function registerStartHandler(bot: Bot, userService: UserService) {
    bot.command("start", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const credentials = await userService.getJiraCredentials(userId);

        if (credentials) {
            await ctx.reply(
                [
                    "👋 سلام!",
                    "",
                    "به Jira Assistant تیم فنی خوش اومدی.",
                    "",
                    "از منوی زیر انتخاب کن:",
                ].join("\n"),
                { reply_markup: mainKeyboard() },
            );
        } else {
            await ctx.reply(
                [
                    "🔐 اتصال به Jira",
                    "",
                    "برای استفاده از امکانات Jira، ابتدا حساب Jira خود را متصل کنید.",
                ].join("\n"),
                { reply_markup: connectJiraKeyboard() },
            );
        }
    });
}
