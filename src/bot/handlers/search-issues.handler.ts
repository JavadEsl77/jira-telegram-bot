import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";

import { SearchService } from "../../jira/services/search.service.js";
import type { UserService } from "../../user/user.service.js";
import type { JiraClientFactory } from "../../jira/jira.client.factory.js";
import type { ConversationStateManager } from "../conversation-state.js";

import { formatIssueCardMinimal, formatIssueList } from "../formatters/issue.formatter.js";
import { issueCardKeyboard } from "../keyboards/issue.keyboard.js";
import { searchNoResultsKeyboard, searchResultsKeyboard } from "../keyboards/search.keyboard.js";

const SEARCH_HEADER = "🔎 نتایج جستجو";

/**
 * نتایج جستجو را برای یک query/page مشخص دریافت و روی پیام بارگذاری (`chatId`/`loadingMessageId`) رندر می‌کند.
 * منطق مشترک بین ورودی از طریق متن (جستجوی اول) و از طریق Callback (صفحه‌بندی/بازگشت) است.
 */
async function deliverSearchResults(
    ctx: Context,
    chatId: number,
    loadingMessageId: number,
    query: string,
    page: number,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
) {
    const userId = ctx.from!.id;

    const credentials = await userService.getJiraCredentials(userId);

    if (!credentials) {
        await ctx.api.editMessageText(
            chatId,
            loadingMessageId,
            "❌ ابتدا حساب Jira خود را متصل کنید.",
        );
        return;
    }

    try {
        const jiraClient = jiraClientFactory.createForUser(credentials);
        const searchService = new SearchService(jiraClient);
        const pageSize = await userService.getTaskPageSize(userId);
        const result = await searchService.searchTasks(query, page, pageSize);

        if (result.issues.length === 0) {
            await ctx.api.editMessageText(
                chatId,
                loadingMessageId,
                [
                    "🔎 نتیجه‌ای پیدا نشد.",
                    "",
                    "عبارت جستجو:",
                    query,
                ].join("\n"),
                { reply_markup: searchNoResultsKeyboard() },
            );
            stateManager.setState(userId, {
                step: "idle",
                searchQuery: query,
                taskListAllMessageIds: [],
            });
            return;
        }

        try {
            await ctx.api.deleteMessage(chatId, loadingMessageId);
        } catch {
            // Message may already be gone — ignore silently
        }

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
                console.error(`Failed to send search result card for ${issue.key}`, err);
            }
        }

        const footerMsg = await ctx.api.sendMessage(
            chatId,
            [
                SEARCH_HEADER,
                "",
                `عبارت جستجو: ${query}`,
                "",
                formatIssueList(result.total, result.page, result.totalPages),
            ].join("\n"),
            { reply_markup: searchResultsKeyboard(result.page, result.totalPages) },
        );

        stateManager.setState(userId, {
            step: "idle",
            searchQuery: query,
            fromPage: undefined,
            taskListAllMessageIds: [...cardMessageIds, footerMsg.message_id],
        });
    } catch (error) {
        console.error("Search failed", error);

        await ctx.api.editMessageText(
            chatId,
            loadingMessageId,
            ["❌ جستجو انجام نشد.", "", "لطفاً دوباره تلاش کنید."].join("\n"),
        );
    }
}

/**
 * نتایج جستجو را از یک Callback (صفحه‌بندی یا بازگشت) نمایش می‌دهد.
 * پیام کلیک‌شده (`ctx.msg`) به‌عنوان پیام بارگذاری استفاده می‌شود.
 */
export async function showSearchResults(
    ctx: Context,
    query: string,
    page: number,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
) {
    await ctx.editMessageText(
        [SEARCH_HEADER, "", "⏳ در حال جستجوی تسک‌ها..."].join("\n"),
    );

    await deliverSearchResults(
        ctx,
        ctx.chat!.id,
        ctx.msg!.message_id,
        query,
        page,
        userService,
        jiraClientFactory,
        stateManager,
    );
}

/**
 * جستجو را از یک پیام متنی (اولین query کاربر) شروع می‌کند.
 * چون پیامی برای Edit وجود ندارد، ابتدا یک پیام Loading جدید ارسال می‌شود.
 */
export async function startSearchFromText(
    ctx: Context,
    query: string,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
) {
    const loadingMsg = await ctx.reply(
        [SEARCH_HEADER, "", "⏳ در حال جستجوی تسک‌ها..."].join("\n"),
    );

    await deliverSearchResults(
        ctx,
        ctx.chat!.id,
        loadingMsg.message_id,
        query,
        1,
        userService,
        jiraClientFactory,
        stateManager,
    );
}

/**
 * Handler‌های جستجوی تسک را ثبت می‌کند.
 *
 * - `search_tasks` — نمایش پیام درخواست عبارت جستجو (ورودی متن در connect-jira.handler.ts پردازش می‌شود)
 * - `search_page:PAGE` — صفحه‌بندی نتایج جستجو (query از state خوانده می‌شود)
 * - `search_back_to_list:PAGE` — بازگشت از Issue Detail به نتایج جستجو
 */
export function registerSearchIssuesHandler(
    bot: Bot,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
) {
    bot.callbackQuery("search_tasks", async (ctx) => {
        await ctx.answerCallbackQuery();

        const userId = ctx.from.id;
        const state = stateManager.getState(userId);

        // Clean up any leftover list/search cards (except the clicked message) before prompting
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

        const isSearchAgain = Boolean(state.searchQuery);

        stateManager.setState(userId, { step: "waiting_for_search_query" });

        await ctx.editMessageText(
            isSearchAgain
                ? "🔎 عبارت جدید را وارد کنید:"
                : ["🔎 جستجوی تسک", "", "عبارت موردنظر خود را وارد کنید:"].join("\n"),
            { reply_markup: new InlineKeyboard() },
        );
    });

    bot.callbackQuery(/^search_page:(\d+)$/, async (ctx) => {
        const page = Number(ctx.match[1]);

        await ctx.answerCallbackQuery();

        const state = stateManager.getState(ctx.from.id);
        const query = state.searchQuery;

        if (!query) {
            await ctx.editMessageText(
                ["🔎 عبارت جستجوی قبلی پیدا نشد.", "", "لطفاً دوباره جستجو کنید."].join("\n"),
                { reply_markup: searchNoResultsKeyboard() },
            );
            return;
        }

        // Delete all previous search list messages except the one being clicked
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

        await showSearchResults(ctx, query, page, userService, jiraClientFactory, stateManager);
    });

    // Back navigation from issue detail — list messages were already deleted when entering issue detail
    bot.callbackQuery(/^search_back_to_list:(\d+)$/, async (ctx) => {
        const page = Number(ctx.match[1]);

        await ctx.answerCallbackQuery();

        const state = stateManager.getState(ctx.from.id);
        const query = state.searchQuery;

        if (!query) {
            await ctx.editMessageText(
                ["🔎 عبارت جستجوی قبلی پیدا نشد.", "", "لطفاً دوباره جستجو کنید."].join("\n"),
                { reply_markup: searchNoResultsKeyboard() },
            );
            return;
        }

        await showSearchResults(ctx, query, page, userService, jiraClientFactory, stateManager);
    });
}
