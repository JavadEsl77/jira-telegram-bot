import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import axios from "axios";

import { IssueService } from "../../jira/services/issue.service.js";
import { CommentService } from "../../jira/services/comment.service.js";
import type { UserService } from "../../user/user.service.js";
import type { JiraClientFactory } from "../../jira/jira.client.factory.js";
import type { ConversationStateManager } from "../conversation-state.js";

import { formatIssue } from "../formatters/issue.formatter.js";
import { issueDetailKeyboard } from "../keyboards/issue-detail.keyboard.js";

/**
 * خطای Jira را برای عملیات کامنت به پیام فارسی قابل‌نمایش تبدیل می‌کند.
 */
function classifyError(err: unknown): string {
    if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) return "❌ اتصال Jira شما معتبر نیست.\n\nلطفاً دوباره حساب Jira را متصل کنید.";
        if (status === 403) return "❌ شما اجازه اضافه کردن کامنت روی این Issue را ندارید.";
        if (status === 404) return "❌ Issue پیدا نشد.";
        if (status && status >= 500) return "❌ Jira در حال حاضر پاسخ نمی‌دهد.\n\nلطفاً دوباره تلاش کنید.";
        if (!err.response) return "❌ Jira در حال حاضر پاسخ نمی‌دهد.\n\nلطفاً دوباره تلاش کنید.";
    }
    return "❌ ارسال کامنت انجام نشد.\n\nلطفاً دوباره تلاش کنید.";
}

/**
 * Handler‌های مربوط به افزودن کامنت را ثبت می‌کند.
 *
 * جریان چهار مرحله‌ای:
 * 1. `comment:<key>` — شروع جریان و درخواست متن کامنت
 * 2. `message:text` (در connect-jira interceptor) — دریافت متن، نمایش پیش‌نمایش
 * 3. `comment-confirm:<key>` — ارسال کامنت به Jira
 * 4. `comment-cancel:<key>` — لغو و بازگشت به Issue Detail
 */
export function registerCommentHandler(
    bot: Bot,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
) {
    /** Credential کاربر را می‌گیرد و سرویس‌های Jira مناسب را برمی‌گرداند. */
    async function getServicesForUser(userId: number) {
        const credentials = await userService.getJiraCredentials(userId);
        if (!credentials) return null;
        const jiraClient = jiraClientFactory.createForUser(credentials);
        return {
            issueService: new IssueService(jiraClient),
            commentService: new CommentService(jiraClient),
        };
    }

    bot.callbackQuery(/^comment:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1];

        await ctx.answerCallbackQuery();

        const credentials = await userService.getJiraCredentials(ctx.from.id);

        if (!credentials) {
            await ctx.editMessageText("❌ ابتدا حساب Jira خود را متصل کنید.");
            return;
        }

        stateManager.setState(ctx.from.id, {
            step: "waiting_for_comment",
            issueKey: issueKey ?? "",
        });

        await ctx.editMessageText(
            [
                `🎫 ${issueKey}`,
                "",
                "💬 متن کامنت خود را ارسال کنید:",
            ].join("\n"),
            { reply_markup: new InlineKeyboard() },
        );
    });

    bot.callbackQuery(/^comment-confirm:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1];

        await ctx.answerCallbackQuery();

        const state = stateManager.getState(ctx.from.id);
        const commentBody = state.commentBody;

        if (!commentBody) {
            await ctx.editMessageText("❌ کامنت پیدا نشد. لطفاً دوباره تلاش کنید.");
            stateManager.clearState(ctx.from.id);
            return;
        }

        await ctx.editMessageText(
            [
                `🎫 ${issueKey}`,
                "",
                "⏳ در حال ارسال کامنت...",
            ].join("\n"),
        );

        const services = await getServicesForUser(ctx.from.id);

        if (!services) {
            await ctx.editMessageText("❌ ابتدا حساب Jira خود را متصل کنید.");
            stateManager.clearState(ctx.from.id);
            return;
        }

        try {
            await services.commentService.addComment(
                issueKey ?? "",
                commentBody,
            );

            stateManager.clearState(ctx.from.id);

            const issue = await services.issueService.getIssue(issueKey ?? "");

            await ctx.editMessageText(formatIssue(issue), {
                reply_markup: issueDetailKeyboard(issue.key),
            });

            await ctx.answerCallbackQuery({
                text: "✅ کامنت با موفقیت اضافه شد",
            });
        } catch (error) {
            console.error(`Failed to add comment to ${issueKey}`, error);
            stateManager.clearState(ctx.from.id);

            await ctx.editMessageText(
                [`🎫 ${issueKey}`, "", classifyError(error)].join("\n"),
            );
        }
    });

    bot.callbackQuery(/^comment-cancel:.+$/, async (ctx) => {
        const issueKey = ctx.match[1];

        await ctx.answerCallbackQuery();

        stateManager.clearState(ctx.from.id);

        const services = await getServicesForUser(ctx.from.id);

        if (!services) {
            await ctx.editMessageText("❌ ابتدا حساب Jira خود را متصل کنید.");
            return;
        }

        try {
            const issue = await services.issueService.getIssue(issueKey ?? "");

            await ctx.editMessageText(formatIssue(issue), {
                reply_markup: issueDetailKeyboard(issue.key),
            });
        } catch (error) {
            console.error(`Failed to fetch issue ${issueKey} on cancel`, error);
            await ctx.editMessageText(
                [`🎫 ${issueKey}`, "", "❌ دریافت اطلاعات تسک با خطا مواجه شد."].join("\n"),
            );
        }
    });

    bot.on("message", async (ctx, next) => {
        const userId = ctx.from.id;
        const state = stateManager.getState(userId);

        if (state.step !== "waiting_for_comment") {
            return next();
        }

        if (!ctx.message.text) {
            await ctx.reply("❌ فعلاً فقط متن قابل ارسال است.");
        }
    });
}
