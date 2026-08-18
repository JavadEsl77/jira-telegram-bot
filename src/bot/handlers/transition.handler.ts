import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";

import { TransitionService } from "../../jira/services/transition.service.js";
import type { UserService } from "../../user/user.service.js";
import type { JiraClientFactory } from "../../jira/jira.client.factory.js";
import type { ConversationStateManager } from "../conversation-state.js";

/**
 * Handler‌های تغییر وضعیت Issue را ثبت می‌کند.
 *
 * جریان سه مرحله‌ای:
 * 1. `transition:<key>` — لیست وضعیت‌های قابل انتخاب را نشان می‌دهد
 * 2. `transition-execute:<key>:<id>` — تأییدیه از کاربر می‌گیرد
 * 3. `transition-confirm:<key>:<id>` — transition را اجرا و Issue به‌روز‌شده را نمایش می‌دهد
 */
export function registerTransitionHandler(
    bot: Bot,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
) {
    /** Credential کاربر را می‌گیرد و سرویس transition مناسب را برمی‌گرداند. */
    async function getServicesForUser(userId: number) {
        const credentials = await userService.getJiraCredentials(userId);
        if (!credentials) return null;
        const jiraClient = jiraClientFactory.createForUser(credentials);
        return {
            transitionService: new TransitionService(jiraClient),
        };
    }

    // نمایش وضعیت‌های قابل انتخاب
    bot.callbackQuery(/^transition:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1];

        await ctx.answerCallbackQuery();
        await ctx.replyWithChatAction("typing");

        const services = await getServicesForUser(ctx.from.id);

        if (!services) {
            await ctx.editMessageText("❌ ابتدا حساب Jira خود را متصل کنید.");
            return;
        }

        try {
            const transitions = await services.transitionService.getAvailable(
                issueKey ?? "",
            );

            if (transitions.length === 0) {
                await ctx.editMessageText(
                    [`🎫 ${issueKey}`, "", "⚠️ وضعیت قابل تغییری وجود ندارد."].join("\n"),
                );
                return;
            }

            const keyboard = transitions.map((transition) => [
                {
                    text: `➡️ ${transition.targetStatus}`,
                    callback_data: `transition-execute:${issueKey}:${transition.id}`,
                },
            ]);

            keyboard.push([
                { text: "◀️ بازگشت", callback_data: `issue:${issueKey}` },
            ]);

            await ctx.editMessageText(
                [`🎫 ${issueKey}`, "", "🔄 وضعیت جدید را انتخاب کنید:"].join("\n"),
                { reply_markup: { inline_keyboard: keyboard } },
            );
        } catch (error) {
            console.error(error);
            await ctx.editMessageText("❌ دریافت وضعیت‌ها ناموفق بود.");
        }
    });

    // Confirmation
    bot.callbackQuery(/^transition-execute:(.+):(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1];
        const transitionId = ctx.match[2];

        await ctx.answerCallbackQuery();

        await ctx.editMessageText(
            [`🎫 ${issueKey}`, "", "⚠️ آیا از تغییر وضعیت مطمئن هستید؟"].join("\n"),
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "✅ تأیید",
                                callback_data: `transition-confirm:${issueKey}:${transitionId}`,
                            },
                            {
                                text: "❌ لغو",
                                callback_data: `issue:${issueKey}`,
                            },
                        ],
                    ],
                },
            },
        );
    });

    // Execute
    bot.callbackQuery(/^transition-confirm:(.+):(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1];
        const transitionId = ctx.match[2];

        await ctx.answerCallbackQuery();

        await ctx.editMessageText(
            [`🎫 ${issueKey}`, "", "⏳ در حال تغییر وضعیت..."].join("\n"),
        );
        await ctx.replyWithChatAction("typing");

        const services = await getServicesForUser(ctx.from.id);

        if (!services) {
            await ctx.editMessageText("❌ ابتدا حساب Jira خود را متصل کنید.");
            return;
        }

        try {
            await services.transitionService.transition(
                issueKey ?? "",
                transitionId ?? "",
            );

            const fromPage = stateManager.getState(ctx.from.id).fromPage ?? 1;

            await ctx.editMessageText(
                [
                    "✅ وضعیت با موفقیت تغییر کرد",
                    "",
                    `🎫 ${issueKey}`,
                ].join("\n"),
                {
                    reply_markup: new InlineKeyboard()
                        .text("◀️ بازگشت به لیست", `back_to_list:${fromPage}`)
                        .row()
                        .text("🏠 منوی اصلی", "back_to_main"),
                },
            );
        } catch (error) {
            console.error(error);
            await ctx.editMessageText(
                [`🎫 ${issueKey}`, "", "❌ تغییر وضعیت انجام نشد."].join("\n"),
            );
        }
    });
}
