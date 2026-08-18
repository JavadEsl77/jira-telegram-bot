import type { Bot } from "grammy";

import { IssueService } from "../../jira/services/issue.service.js";
import type { UserService } from "../../user/user.service.js";
import type { JiraClientFactory } from "../../jira/jira.client.factory.js";
import type { ConversationStateManager } from "../conversation-state.js";

import { formatIssue } from "../formatters/issue.formatter.js";
import { issueDetailKeyboard } from "../keyboards/issue-detail.keyboard.js";

/**
 * Handler جزئیات یک Issue را ثبت می‌کند.
 * الگوی callback: `issue:<issueKey>:<page>` (مثال: `issue:PROJ-123:2`).
 *
 * هنگام ورود به Issue Detail:
 * - تمام پیام‌های لیست به‌جز کارت کلیک‌شده حذف می‌شوند.
 * - `fromPage` در state ذخیره می‌شود تا بازگشت به صفحه درست امکان‌پذیر باشد.
 */
export function registerIssueDetailHandler(
    bot: Bot,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
) {
    bot.callbackQuery(/^issue:([^:]+)(?::(\d+))?$/, async (ctx) => {
        const issueKey = ctx.match[1];
        const state = stateManager.getState(ctx.from.id);
        const fromPage = ctx.match[2] ? Number(ctx.match[2]) : (state.fromPage ?? 1);

        await ctx.answerCallbackQuery();

        // Delete all list messages except the clicked card (which becomes the detail view)
        const currentMsgId = ctx.msg!.message_id;
        const chatId = ctx.chat!.id;
        for (const msgId of state.taskListAllMessageIds ?? []) {
            if (msgId === currentMsgId) continue;
            try {
                await ctx.api.deleteMessage(chatId, msgId);
            } catch {
                // Message may be too old or already deleted — ignore silently
            }
        }

        const credentials = await userService.getJiraCredentials(ctx.from.id);

        if (!credentials) {
            await ctx.editMessageText("❌ ابتدا حساب Jira خود را متصل کنید.");
            return;
        }

        try {
            const jiraClient = jiraClientFactory.createForUser(credentials);
            const issueService = new IssueService(jiraClient);
            const issue = await issueService.getIssue(issueKey ?? "");

            // Record fromPage; clear list IDs (all deleted or repurposed)
            stateManager.setState(ctx.from.id, {
                ...state,
                taskListAllMessageIds: undefined,
                fromPage,
            });

            // Route "back" to search results if the list we came from was a search, otherwise My Tasks
            const backCallback = state.searchQuery
                ? `search_back_to_list:${fromPage}`
                : `back_to_list:${fromPage}`;

            await ctx.editMessageText(formatIssue(issue), {
                reply_markup: issueDetailKeyboard(issue.key, fromPage, backCallback),
            });
        } catch (error) {
            console.error(`Failed to fetch issue ${issueKey}`, error);

            await ctx.editMessageText(
                "❌ دریافت اطلاعات تسک با خطا مواجه شد.",
            );
        }
    });
}
