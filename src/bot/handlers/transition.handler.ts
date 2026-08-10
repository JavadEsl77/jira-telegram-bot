import type { Bot } from "grammy";

import { IssueService } from "../../jira/services/issue.service.js";
import { TransitionService } from "../../jira/services/transition.service.js";
import type { UserService } from "../../user/user.service.js";
import type { JiraClientFactory } from "../../jira/jira.client.factory.js";

import { formatIssue } from "../formatters/issue.formatter.js";
import { issueDetailKeyboard } from "../keyboards/issue-detail.keyboard.js";

export function registerTransitionHandler(
    bot: Bot,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
) {
    async function getServicesForUser(userId: number) {
        const credentials = await userService.getJiraCredentials(userId);
        if (!credentials) return null;
        const jiraClient = jiraClientFactory.createForUser(credentials);
        return {
            issueService: new IssueService(jiraClient),
            transitionService: new TransitionService(jiraClient),
        };
    }

    // نمایش وضعیت‌های قابل انتخاب
    bot.callbackQuery(/^transition:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1];

        await ctx.answerCallbackQuery();

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

            const issue = await services.issueService.getIssue(issueKey ?? "");

            await ctx.editMessageText(formatIssue(issue), {
                reply_markup: issueDetailKeyboard(issue.key),
            });

            await ctx.answerCallbackQuery({
                text: "✅ وضعیت با موفقیت تغییر کرد",
            });
        } catch (error) {
            console.error(error);
            await ctx.editMessageText(
                [`🎫 ${issueKey}`, "", "❌ تغییر وضعیت انجام نشد."].join("\n"),
            );
        }
    });
}
