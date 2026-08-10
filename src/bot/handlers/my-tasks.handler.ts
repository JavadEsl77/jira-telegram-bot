import type { Bot } from "grammy";

import { IssueService } from "../../jira/services/issue.service.js";
import type { UserService } from "../../user/user.service.js";
import type { JiraClientFactory } from "../../jira/jira.client.factory.js";

import {
    formatIssueCard,
    formatIssueList,
} from "../formatters/issue.formatter.js";
import { issueListKeyboard } from "../keyboards/issue.keyboard.js";

export function registerMyTasksHandler(
    bot: Bot,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
) {
    bot.callbackQuery(/^my_tasks(?::(\d+))?$/, async (ctx) => {
        const page = Number(ctx.match[1] ?? 1);

        await ctx.answerCallbackQuery();

        await ctx.editMessageText(
            ["📋 تسک‌های من", "", "⏳ در حال دریافت تسک‌های شما..."].join("\n"),
        );

        const credentials = await userService.getJiraCredentials(ctx.from.id);

        if (!credentials) {
            await ctx.editMessageText("❌ ابتدا حساب Jira خود را متصل کنید.");
            return;
        }

        try {
            const jiraClient = jiraClientFactory.createForUser(credentials);
            const issueService = new IssueService(jiraClient);
            const result = await issueService.getMyTasks(page, 5);

            const cards = result.issues
                .map(formatIssueCard)
                .join("\n\n────────────\n\n");

            const text = [
                formatIssueList(result.issues, result.page, result.totalPages),
                "",
                cards,
            ].join("\n");

            await ctx.editMessageText(text, {
                reply_markup: issueListKeyboard(
                    result.issues,
                    result.page,
                    result.totalPages,
                ),
            });
        } catch (error) {
            console.error("Failed to fetch my tasks", error);

            await ctx.editMessageText(
                ["📋 تسک‌های من", "", "❌ دریافت تسک‌ها با خطا مواجه شد."].join("\n"),
            );
        }
    });
}
