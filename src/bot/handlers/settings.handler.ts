import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";

import { TASK_PAGE_SIZE_MIN, TASK_PAGE_SIZE_MAX } from "../../user/user.service.js";
import type { UserService } from "../../user/user.service.js";
import type { ConversationStateManager } from "../conversation-state.js";

import { mainKeyboard } from "../keyboards/main.keyboard.js";
import { settingsKeyboard } from "../keyboards/settings.keyboard.js";
import { connectJiraKeyboard } from "../keyboards/connect-jira.keyboard.js";

/**
 * Handler‌های صفحه تنظیمات را ثبت می‌کند.
 * Callback‌های پشتیبانی‌شده: `settings`، `back_to_main`، `disconnect_jira`، `set_page_size`.
 * هنگام قطع اتصال، وضعیت مکالمه کاربر هم پاک می‌شود.
 */
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

        // Clean up any leftover task/search list cards (except the clicked message) before showing the menu
        const state = stateManager.getState(ctx.from.id);
        const clickedMsgId = ctx.msg!.message_id;
        if (state.taskListAllMessageIds?.length) {
            for (const msgId of state.taskListAllMessageIds) {
                if (msgId === clickedMsgId) continue;
                try {
                    await ctx.api.deleteMessage(ctx.chat!.id, msgId);
                } catch {
                    // Message may be too old or already deleted — ignore silently
                }
            }
        }
        stateManager.setState(ctx.from.id, {
            ...state,
            step: "idle",
            taskListAllMessageIds: undefined,
            searchQuery: undefined,
            fromPage: undefined,
        });

        await ctx.editMessageText(
            ["👋 سلام!", "", "از منوی زیر انتخاب کن:"].join("\n"),
            { reply_markup: mainKeyboard() },
        );
    });

    bot.callbackQuery("set_page_size", async (ctx) => {
        await ctx.answerCallbackQuery();

        const userId = ctx.from.id;
        const currentSize = await userService.getTaskPageSize(userId);

        stateManager.setState(userId, { step: "waiting_for_page_size" });

        await ctx.editMessageText(
            [
                "📄 تعداد تسک در هر صفحه",
                "",
                `مقدار فعلی: ${currentSize}`,
                "",
                `یک عدد بین ${TASK_PAGE_SIZE_MIN} تا ${TASK_PAGE_SIZE_MAX} ارسال کن:`,
            ].join("\n"),
            { reply_markup: new InlineKeyboard() },
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
