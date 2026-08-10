import type { Bot } from "grammy";

import type { UserService } from "../../user/user.service.js";
import type { ConversationStateManager } from "../conversation-state.js";

import { mainKeyboard } from "../keyboards/main.keyboard.js";
import { settingsKeyboard } from "../keyboards/settings.keyboard.js";
import { connectJiraKeyboard } from "../keyboards/connect-jira.keyboard.js";

export function registerSettingsHandler(
    bot: Bot,
    userService: UserService,
    stateManager: ConversationStateManager,
) {
    bot.callbackQuery("settings", async (ctx) => {
        await ctx.answerCallbackQuery();

        await ctx.editMessageText("⚙️ تنظیمات", {
            reply_markup: settingsKeyboard(),
        });
    });

    bot.callbackQuery("back_to_main", async (ctx) => {
        await ctx.answerCallbackQuery();

        await ctx.editMessageText(
            ["👋 سلام!", "", "از منوی زیر انتخاب کن:"].join("\n"),
            { reply_markup: mainKeyboard() },
        );
    });

    bot.callbackQuery("disconnect_jira", async (ctx) => {
        await ctx.answerCallbackQuery();

        const userId = ctx.from.id;

        await userService.disconnectJira(userId);
        stateManager.clearState(userId);

        await ctx.editMessageText(
            [
                "✅ حساب Jira با موفقیت قطع شد.",
                "",
                "🔐 اتصال به Jira",
                "",
                "برای استفاده از امکانات Jira، ابتدا حساب Jira خود را متصل کنید.",
            ].join("\n"),
            { reply_markup: connectJiraKeyboard() },
        );
    });
}
