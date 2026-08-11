import type { Bot } from "grammy";

import { IssueService } from "../../jira/services/issue.service.js";
import type { UserService } from "../../user/user.service.js";
import type { JiraClientFactory } from "../../jira/jira.client.factory.js";

import { formatIssue } from "../formatters/issue.formatter.js";
import { issueDetailKeyboard } from "../keyboards/issue-detail.keyboard.js";

/**
 * Handler جزئیات یک Issue را ثبت می‌کند.
 * الگوی callback: `issue:<issueKey>` (مثال: `issue:PROJ-123`).
 */
export function registerIssueDetailHandler(
    bot: Bot,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
) {
    bot.callbackQuery(/^issue:([^:]+)(?::(\d+))?$/, async (ctx) => {
        const issueKey = ctx.match[1];
        const fromPage = Number(ctx.match[2] ?? 1);

        await ctx.answerCallbackQuery();

        const credentials = await userService.getJiraCredentials(ctx.from.id);

        if (!credentials) {
            await ctx.editMessageText("❌ ابتدا حساب Jira خود را متصل کنید.");
            return;
        }

        try {
            const jiraClient = jiraClientFactory.createForUser(credentials);
            const issueService = new IssueService(jiraClient);
            const issue = await issueService.getIssue(issueKey ?? "");

            await ctx.editMessageText(formatIssue(issue), {
                reply_markup: issueDetailKeyboard(issue.key, fromPage),
            });
        } catch (error) {
            console.error(`Failed to fetch issue ${issueKey}`, error);

            await ctx.editMessageText(
                "❌ دریافت اطلاعات تسک با خطا مواجه شد.",
            );
        }
    });
}
