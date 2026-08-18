import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import axios from "axios";

import type { ConversationStateManager } from "../conversation-state.js";
import type { UserService } from "../../user/user.service.js";
import type { JiraClientFactory } from "../../jira/jira.client.factory.js";

import { mainKeyboard } from "../keyboards/main.keyboard.js";
import { retryConnectJiraKeyboard } from "../keyboards/connect-jira.keyboard.js";
import { worklogDateKeyboard, worklogPreviewKeyboard } from "../keyboards/worklog.keyboard.js";
import { settingsKeyboard } from "../keyboards/settings.keyboard.js";
import { parseDuration, formatDuration, looksLikeDuration } from "../utils/duration-parser.js";
import { TASK_PAGE_SIZE_MIN, TASK_PAGE_SIZE_MAX } from "../../user/user.service.js";
import { startSearchFromText } from "./search-issues.handler.js";

/** حداکثر طول مجاز عبارت جستجو */
const SEARCH_QUERY_MAX_LENGTH = 100;


/**
 * خطای Jira را به پیام فارسی قابل‌نمایش تبدیل می‌کند.
 * بین خطاهای ۴۰۱/۴۰۳/۴۰۴/5xx و خطای شبکه تمایز قائل می‌شود.
 */
function classifyError(err: unknown): string {
    if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) return "❌ خطای ۴۰۱: Token پذیرفته نشد.";
        if (status === 403) return "❌ خطای ۴۰۳: دسترسی مجاز نیست.";
        if (status === 404) return "❌ خطای ۴۰۴: Jira API endpoint پیدا نشد.";
        if (status && status >= 500) return `❌ خطای ${status}: مشکل در سرور Jira.`;
        if (!err.response) return "❌ خطای شبکه: اتصال به Jira برقرار نشد.";
    }
    return "❌ خطای ناشناخته در اتصال به Jira.";
}

/**
 * Handler جریان اتصال Jira را ثبت می‌کند.
 *
 * دو handler ثبت می‌کند:
 * 1. callback `connect_jira` — وضعیت کاربر را به `waiting_for_jira_token` تغییر می‌دهد
 * 2. `message:text` — PAT را دریافت می‌کند، با `/myself` تأیید می‌کند، و ذخیره می‌کند
 *
 * این handler باید اول از همه ثبت شود تا text interceptor فعال باشد.
 */
export function registerConnectJiraHandler(
    bot: Bot,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
) {
    bot.callbackQuery("connect_jira", async (ctx) => {
        const userId = ctx.from.id;
        await ctx.answerCallbackQuery();

        stateManager.setState(userId, { step: "waiting_for_jira_token" });

        await ctx.editMessageText(
            [
                "🔐 برای اتصال به Jira، به Access Token اکانتت نیاز داریم.",
                "",
                "وارد Jira شو و از مسیر Profile → Personal Access Tokens یک Token جدید بساز و سپس Token رو همینجا برای من ارسال کن.",
                "",
                "⚠️ توکن فقط برای اتصال بات به حساب Jira شما استفاده میشه.",
            ].join("\n"),
            { reply_markup: new InlineKeyboard() },
        );
    });

    // Must be registered before command handlers to intercept text messages during auth flow
    bot.on("message:text", async (ctx, next) => {
        const userId = ctx.from.id;
        const state = stateManager.getState(userId);

        if (state.step === "idle") {
            return next();
        }

        const text = ctx.message.text;

        // Commands always cancel the current conversation flow
        if (text.startsWith("/")) {
            stateManager.clearState(userId);
            return next();
        }

        if (state.step === "waiting_for_jira_token") {
            const token = text.trim();

            stateManager.clearState(userId);

            await ctx.reply("⏳ در حال بررسی Token...");

            try {
                const jiraClient = jiraClientFactory.createForUser({ token });
                const myself = await jiraClient.getCurrentUser();

                const username =
                    typeof myself.name === "string" ? myself.name : "";
                const displayName =
                    typeof myself.displayName === "string"
                        ? myself.displayName
                        : undefined;

                await userService.connectJira(userId, username, token, displayName);

                await ctx.reply(
                    [
                        "✅ حساب Jira با موفقیت متصل شد.",
                        "",
                        `👤 ${displayName ?? username}`,
                    ].join("\n"),
                    { reply_markup: mainKeyboard() },
                );
            } catch (err) {
                const reason = classifyError(err);

                await ctx.reply(
                    [
                        "❌ اتصال به Jira انجام نشد.",
                        "",
                        reason,
                        "",
                        "مطمئن شوید Token معتبر است و منقضی نشده.",
                    ].join("\n"),
                    { reply_markup: retryConnectJiraKeyboard() },
                );
            }
        }

        if (state.step === "waiting_for_page_size") {
            const trimmed = text.trim();
            const value = Number(trimmed);

            if (
                !Number.isInteger(value) ||
                value < TASK_PAGE_SIZE_MIN ||
                value > TASK_PAGE_SIZE_MAX
            ) {
                await ctx.reply(
                    `❌ عدد واردشده معتبر نیست.\n\nیک عدد صحیح بین ${TASK_PAGE_SIZE_MIN} تا ${TASK_PAGE_SIZE_MAX} ارسال کن.`,
                );
                return;
            }

            stateManager.clearState(userId);

            await userService.setTaskPageSize(userId, value);

            await ctx.reply(
                [
                    "✅ تعداد تسک در هر صفحه به‌روزرسانی شد.",
                    "",
                    `📄 مقدار جدید: ${value}`,
                ].join("\n"),
                { reply_markup: settingsKeyboard() },
            );
            return;
        }

        if (state.step === "waiting_for_search_query") {
            const trimmed = text.trim();

            if (!trimmed) {
                await ctx.reply("🔎 عبارت جستجو نمی‌تواند خالی باشد.");
                return;
            }

            if (trimmed.length > SEARCH_QUERY_MAX_LENGTH) {
                await ctx.reply(
                    ["❌ عبارت جستجو معتبر نیست.", "", "لطفاً عبارت دیگری وارد کنید."].join("\n"),
                );
                return;
            }

            stateManager.clearState(userId);

            await startSearchFromText(ctx, trimmed, userService, jiraClientFactory, stateManager);
            return;
        }

        if (state.step === "waiting_for_comment") {
            const trimmed = text.trim();

            if (!trimmed) {
                await ctx.reply(
                    "❌ متن کامنت نمی‌تواند خالی باشد.\n\nلطفاً متن کامنت را ارسال کنید.",
                );
                return;
            }

            if (trimmed.length > 5000) {
                await ctx.reply(
                    "❌ متن کامنت بیش از حد طولانی است.\n\nحداکثر 5000 کاراکتر.",
                );
                return;
            }

            const issueKey = state.issueKey ?? "";

            stateManager.setState(userId, {
                step: "waiting_for_comment",
                issueKey,
                commentBody: trimmed,
            });

            const previewKeyboard = new InlineKeyboard()
                .text("✅ ارسال کامنت", `comment-confirm:${issueKey}`)
                .text("❌ لغو", `comment-cancel:${issueKey}`);

            await ctx.reply(
                [
                    "💬 پیش‌نمایش کامنت",
                    "",
                    trimmed,
                    "",
                    "آیا کامنت ارسال شود؟",
                ].join("\n"),
                { reply_markup: previewKeyboard },
            );
        }

        if (state.step === "waiting_for_worklog_duration") {
            const trimmed = text.trim();

            if (!looksLikeDuration(trimmed)) {
                await ctx.reply(
                    [
                        "❌ فرمت زمان صحیح نیست.",
                        "",
                        "مثال:",
                        "1h 30m",
                        "45m",
                        "2h",
                    ].join("\n"),
                );
                return;
            }

            const parsed = parseDuration(trimmed);
            if (!parsed) {
                await ctx.reply(
                    [
                        "❌ فرمت زمان صحیح نیست.",
                        "",
                        "مثال:",
                        "1h 30m",
                        "45m",
                        "2h",
                    ].join("\n"),
                );
                return;
            }

            const issueKey = state.issueKey ?? "";
            const durationStr = formatDuration(parsed);

            const now = new Date();
            let startTime = new Date(now);
            startTime.setMinutes(startTime.getMinutes() - parsed.totalMinutes);

            const startedAt = buildIsoDateTime(startTime);

            stateManager.setState(userId, {
                step: "selecting_worklog_date",
                issueKey,
                worklogDuration: durationStr,
                worklogDurationMinutes: parsed.totalMinutes,
                worklogStartedAt: startedAt,
            });

            await ctx.reply(
                [
                    "📅 تاریخ انجام کار",
                    "",
                    "زمانی که این کار را انجام دادی انتخاب کن:",
                ].join("\n"),
                { reply_markup: worklogDateKeyboard(issueKey) },
            );
        }

        if (state.step === "selecting_worklog_time") {
            const trimmed = text.trim();

            if (!/^\d{2}:\d{2}$/.test(trimmed)) {
                await ctx.reply(
                    [
                        "❌ ساعت واردشده معتبر نیست.",
                        "",
                        "مثال:",
                        "14:30",
                    ].join("\n"),
                );
                return;
            }

            const [hoursStr, minutesStr] = trimmed.split(":");
            const hours = Number.parseInt(hoursStr ?? "", 10);
            const minutes = Number.parseInt(minutesStr ?? "", 10);

            if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                await ctx.reply(
                    [
                        "❌ ساعت واردشده معتبر نیست.",
                        "",
                        "مثال:",
                        "14:30",
                    ].join("\n"),
                );
                return;
            }

            const issueKey = state.issueKey ?? "";
            const dateStr = state.worklogSelectedDate ?? getTodayString();

            const startTime = new Date(`${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
            const startedAt = buildIsoDateTime(startTime);

            stateManager.setState(userId, {
                ...state,
                step: "confirm_worklog",
                worklogStartedAt: startedAt,
            });

            const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
            const previewText = [
                "⏱ پیش‌نمایش ثبت زمان",
                "",
                `🎫 ${issueKey}`,
                "",
                `📅 تاریخ: ${formatDatePersian(dateStr)}`,
                `🕐 شروع: ${timeStr}`,
                `⏱ مدت: ${state.worklogDuration ?? ""}`,
                "",
                "آیا این زمان ثبت شود؟",
            ].join("\n");

            await ctx.reply(previewText, {
                reply_markup: worklogPreviewKeyboard(issueKey),
            });
            return;
        }
    });

    bot.on("message", async (ctx, next) => {
        const userId = ctx.from.id;
        const state = stateManager.getState(userId);

        if (state.step === "idle") {
            return next();
        }

        if (
            state.step === "waiting_for_worklog_duration" ||
            state.step === "selecting_worklog_time"
        ) {
            if (!ctx.message.text) {
                await ctx.reply("❌ لطفاً مقدار را به صورت متنی ارسال کنید.");
                return;
            }
        }

        return next();
    });
}

function formatDatePersian(dateStr: string): string {
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;

    const year = Number.parseInt(parts[0] ?? "", 10);
    const month = Number.parseInt(parts[1] ?? "", 10);
    const day = Number.parseInt(parts[2] ?? "", 10);

    const { toJalaali } = require("jalaali-js") as typeof import("jalaali-js");
    const j = toJalaali(year, month, day);
    const persianMonth = [
        "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
        "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
    ];

    return `${j.jd} ${persianMonth[j.jm - 1]} ${j.jy}`;
}

function buildIsoDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const ms = String(date.getMilliseconds()).padStart(3, "0");

    const rawOffset = -date.getTimezoneOffset();
    const sign = rawOffset >= 0 ? "+" : "-";
    const absOffset = Math.abs(rawOffset);
    const tzHours = String(Math.floor(absOffset / 60)).padStart(2, "0");
    const tzMins = String(absOffset % 60).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${sign}${tzHours}${tzMins}`;
}

function getTodayString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
