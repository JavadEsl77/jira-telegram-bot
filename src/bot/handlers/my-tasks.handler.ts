import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";

import { IssueService } from "../../jira/services/issue.service.js";
import type { UserService } from "../../user/user.service.js";
import type { JiraClientFactory } from "../../jira/jira.client.factory.js";
import type { ConversationStateManager } from "../conversation-state.js";

import { formatIssueCardMinimal, formatIssueList } from "../formatters/issue.formatter.js";
import { issueCardKeyboard, paginationKeyboard } from "../keyboards/issue.keyboard.js";

/**
 * لیست تسک‌ها را بارگذاری و نمایش می‌دهد.
 * پیام جاری (ctx.msg) صرفاً وضعیت بارگذاری را نشان می‌دهد و در پایان حذف می‌شود؛
 * Header و صفحه‌بندی هر دو در یک پیام واحد زیر لیست کارت‌ها ارسال می‌شوند.
 */
async function showTaskList(
    ctx: Context,
    page: number,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
) {
    const state = stateManager.getState(ctx.from!.id);

    await ctx.editMessageText(
        ["📋 تسک‌های من", "", "⏳ در حال دریافت تسک‌های شما..."].join("\n"),
    );

    const credentials = await userService.getJiraCredentials(ctx.from!.id);

    if (!credentials) {
        await ctx.editMessageText("❌ ابتدا حساب Jira خود را متصل کنید.");
        return;
    }

    try {
        const jiraClient = jiraClientFactory.createForUser(credentials);
        const issueService = new IssueService(jiraClient);
        const pageSize = await userService.getTaskPageSize(ctx.from!.id);
        const result = await issueService.getMyTasks(page, pageSize);

        if (result.issues.length === 0) {
            await ctx.editMessageText(
                ["📋 تسک‌های من", "", "تسکی برای نمایش پیدا نشد."].join("\n"),
                { reply_markup: new InlineKeyboard().text("🏠 منوی اصلی", "back_to_main") },
            );
            stateManager.setState(ctx.from!.id, {
                step: "idle",
                taskListAllMessageIds: [],
                searchQuery: undefined,
            });
            return;
        }

        // The loading message is no longer needed — header now shows below the list
        try {
            await ctx.api.deleteMessage(ctx.chat!.id, ctx.msg!.message_id);
        } catch {
            // Message may already be gone — ignore silently
        }

        const chatId = ctx.chat!.id;
        const jiraBaseUrl = process.env.JIRA_BASE_URL ?? "";
        const cardMessageIds: number[] = [];

        for (const issue of result.issues) {
            try {
                const sent = await ctx.api.sendMessage(
                    chatId,
                    formatIssueCardMinimal(issue, jiraBaseUrl),
                    {
                        reply_markup: issueCardKeyboard(issue.key, page),
                        parse_mode: "HTML",
                    },
                );
                cardMessageIds.push(sent.message_id);
            } catch (err) {
                console.error(`Failed to send card for ${issue.key}`, err);
            }
        }

        const footerMsg = await ctx.api.sendMessage(
            chatId,
            [
                formatIssueList(result.total, result.page, result.totalPages),
            ].join("\n"),
            { reply_markup: paginationKeyboard(result.page, result.totalPages) },
        );

        stateManager.setState(ctx.from!.id, {
            ...state,
            fromPage: undefined,
            searchQuery: undefined,
            taskListAllMessageIds: [...cardMessageIds, footerMsg.message_id],
        });
    } catch (error) {
        console.error("Failed to fetch my tasks", error);

        await ctx.editMessageText(
            ["📋 تسک‌های من", "", "❌ دریافت تسک‌ها با خطا مواجه شد."].join("\n"),
        );
    }
}

/**
 * Handler لیست تسک‌ها و ناوبری بازگشت به لیست را ثبت می‌کند.
 *
 * - `my_tasks[:PAGE]` — pagination از داخل لیست: پیام‌های قبلی (به‌جز پیام کلیک‌شده) حذف می‌شوند.
 * - `back_to_list:PAGE` — بازگشت از Issue Detail یا پیام موفقیت: بدون cleanup اضافی.
 */
export function registerMyTasksHandler(
    bot: Bot,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
) {
    bot.callbackQuery(/^my_tasks(?::(\d+))?$/, async (ctx) => {
        const page = Number(ctx.match[1] ?? 1);

        await ctx.answerCallbackQuery();

        // Delete all previous list messages except the one being clicked (reused for the loading text, then deleted in showTaskList)
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

        await showTaskList(ctx, page, userService, jiraClientFactory, stateManager);
    });

    // Back navigation from issue detail or action success messages
    bot.callbackQuery(/^back_to_list:(\d+)$/, async (ctx) => {
        const page = Number(ctx.match[1]);

        await ctx.answerCallbackQuery();

        // No cleanup needed — list messages were deleted when entering issue detail
        await showTaskList(ctx, page, userService, jiraClientFactory, stateManager);
    });
}
