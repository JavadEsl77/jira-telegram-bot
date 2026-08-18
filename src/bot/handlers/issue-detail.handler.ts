import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";

import { IssueService } from "../../jira/services/issue.service.js";
import { CommentService } from "../../jira/services/comment.service.js";
import type { UserService } from "../../user/user.service.js";
import type { JiraClientFactory } from "../../jira/jira.client.factory.js";
import type { ConversationStateManager } from "../conversation-state.js";

import {
    formatIssue,
    formatIssueComments,
    formatIssueDescription,
} from "../formatters/issue.formatter.js";
import { issueDetailKeyboard } from "../keyboards/issue-detail.keyboard.js";

/** تعداد کامنت در هر صفحه از «همه کامنت‌ها» */
const COMMENT_PAGE_SIZE = 5;

function buildJiraUrl(issueKey: string): string {
    const jiraBaseUrl = process.env.JIRA_BASE_URL ?? "";
    return `${jiraBaseUrl}/browse/${issueKey}`;
}

/**
 * Handler جزئیات یک Issue را ثبت می‌کند.
 * الگوی callback: `issue:<issueKey>:<page>` (مثال: `issue:PROJ-123:2`).
 *
 * هنگام ورود به Issue Detail:
 * - تمام پیام‌های لیست به‌جز کارت کلیک‌شده حذف می‌شوند.
 * - `fromPage` در state ذخیره می‌شود تا بازگشت به صفحه درست امکان‌پذیر باشد.
 *
 * همچنین دو صفحه اختصاصی را ثبت می‌کند:
 * - `issue-desc:<key>` — توضیحات کامل (برای متن‌های طولانی که در Summary جا نمی‌شوند)
 * - `issue-comments:<key>:<page>` — همه کامنت‌ها، صفحه‌بندی‌شده
 * بازگشت از هر دو صفحه دوباره همان callback `issue:<key>` را صدا می‌زند (بدون منطق جدید).
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
        await ctx.replyWithChatAction("typing");

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

        await ctx.editMessageText("⏳ در حال دریافت اطلاعات تسک...");

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

            const hasDescription = typeof issue.fields.description === "string"
                && issue.fields.description.trim().length > 0;

            await ctx.editMessageText(formatIssue(issue), {
                reply_markup: issueDetailKeyboard(
                    issue.key,
                    buildJiraUrl(issue.key),
                    hasDescription,
                    fromPage,
                    backCallback,
                ),
            });
        } catch (error) {
            console.error(`Failed to fetch issue ${issueKey}`, error);

            await ctx.editMessageText(
                "❌ دریافت اطلاعات تسک با خطا مواجه شد.",
            );
        }
    });

    bot.callbackQuery(/^issue-desc:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1] ?? "";

        await ctx.answerCallbackQuery();
        await ctx.replyWithChatAction("typing");

        await ctx.editMessageText(
            [`🎫 ${issueKey}`, "", "⏳ در حال دریافت توضیحات..."].join("\n"),
        );

        const credentials = await userService.getJiraCredentials(ctx.from.id);

        if (!credentials) {
            await ctx.editMessageText("❌ ابتدا حساب Jira خود را متصل کنید.");
            return;
        }

        try {
            const jiraClient = jiraClientFactory.createForUser(credentials);
            const issueService = new IssueService(jiraClient);
            const issue = await issueService.getIssue(issueKey);

            await ctx.editMessageText(formatIssueDescription(issue), {
                reply_markup: new InlineKeyboard().text("◀️ بازگشت به تسک", `issue:${issueKey}`),
            });
        } catch (error) {
            console.error(`Failed to fetch description for ${issueKey}`, error);

            await ctx.editMessageText(
                [`🎫 ${issueKey}`, "", "❌ دریافت توضیحات با خطا مواجه شد."].join("\n"),
                { reply_markup: new InlineKeyboard().text("◀️ بازگشت به تسک", `issue:${issueKey}`) },
            );
        }
    });

    bot.callbackQuery(/^issue-comments:([^:]+)(?::(\d+))?$/, async (ctx) => {
        const issueKey = ctx.match[1] ?? "";
        const page = ctx.match[2] ? Number(ctx.match[2]) : 1;

        await showComments(ctx, issueKey, page, userService, jiraClientFactory);
    });
}

async function showComments(
    ctx: Context,
    issueKey: string,
    page: number,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
) {
    await ctx.answerCallbackQuery();
    await ctx.replyWithChatAction("typing");

    await ctx.editMessageText(
        [`🎫 ${issueKey}`, "", "⏳ در حال دریافت کامنت‌ها..."].join("\n"),
    );

    const credentials = await userService.getJiraCredentials(ctx.from!.id);

    if (!credentials) {
        await ctx.editMessageText("❌ ابتدا حساب Jira خود را متصل کنید.");
        return;
    }

    try {
        const jiraClient = jiraClientFactory.createForUser(credentials);
        const commentService = new CommentService(jiraClient);
        const result = await commentService.getComments(issueKey, page, COMMENT_PAGE_SIZE);

        const keyboard = new InlineKeyboard();

        if (result.totalPages > 1) {
            if (result.page > 1) {
                keyboard.text("◀️ قبلی", `issue-comments:${issueKey}:${result.page - 1}`);
            }
            if (result.page < result.totalPages) {
                keyboard.text("بعدی ▶️", `issue-comments:${issueKey}:${result.page + 1}`);
            }
            keyboard.row();
        }

        keyboard.text("◀️ بازگشت به تسک", `issue:${issueKey}`);

        await ctx.editMessageText(
            formatIssueComments(issueKey, result.comments, result.page, result.totalPages, result.total),
            { reply_markup: keyboard },
        );
    } catch (error) {
        console.error(`Failed to fetch comments for ${issueKey}`, error);

        await ctx.editMessageText(
            [`🎫 ${issueKey}`, "", "❌ دریافت کامنت‌ها با خطا مواجه شد."].join("\n"),
            { reply_markup: new InlineKeyboard().text("◀️ بازگشت به تسک", `issue:${issueKey}`) },
        );
    }
}
