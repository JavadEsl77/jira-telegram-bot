import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import axios from "axios";

import { IssueService } from "../../jira/services/issue.service.js";
import { WorklogService } from "../../jira/services/worklog.service.js";
import type { UserService } from "../../user/user.service.js";
import type { JiraClientFactory } from "../../jira/jira.client.factory.js";
import type { ConversationStateManager } from "../conversation-state.js";

import {
    worklogDateKeyboard,
    worklogTimeKeyboard,
    worklogPreviewKeyboard,
    worklogEditKeyboard,
    emptyKeyboard,
} from "../keyboards/worklog.keyboard.js";
import { buildCalendarKeyboard } from "../utils/calendar.js";
import { getTodayString, getYesterdayString, gregorianToJalali } from "../utils/calendar.js";
import { parseDuration, formatDuration } from "../utils/duration-parser.js";
import { formatIssue } from "../formatters/issue.formatter.js";
import { issueDetailKeyboard } from "../keyboards/issue-detail.keyboard.js";

function classifyError(err: unknown): string {
    if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) return "❌ اتصال Jira شما معتبر نیست.\n\nلطفاً دوباره حساب Jira را متصل کنید.";
        if (status === 403) return "❌ شما اجازه ثبت زمان روی این Issue را ندارید.";
        if (status === 404) return "❌ Issue پیدا نشد.";
        if (status && status >= 500) return "❌ Jira در حال حاضر پاسخ نمی‌دهد.\n\nلطفاً دوباره تلاش کنید.";
        if (!err.response) return "❌ Jira در حال حاضر پاسخ نمی‌دهد.\n\nلطفاً دوباره تلاش کنید.";
    }
    return "❌ ثبت زمان انجام نشد.\n\nلطفاً دوباره تلاش کنید.";
}

function formatDatePersian(dateStr: string): string {
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;

    const j = gregorianToJalali(dateStr);
    const persianMonth = [
        "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
        "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
    ];

    return `${j.jd} ${persianMonth[j.jm - 1]} ${j.jy}`;
}

export function registerWorklogHandler(
    bot: Bot,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
) {
    bot.callbackQuery(/^worklog:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1];

        await ctx.answerCallbackQuery();

        const credentials = await userService.getJiraCredentials(ctx.from.id);
        if (!credentials) {
            await ctx.editMessageText("❌ ابتدا حساب Jira خود را متصل کنید.");
            return;
        }

        const currentState = stateManager.getState(ctx.from.id);
        stateManager.setState(ctx.from.id, {
            step: "waiting_for_worklog_duration",
            issueKey,
            fromPage: currentState.fromPage,
        });

        await ctx.editMessageText(
            [
                "⏱ ثبت زمان",
                "",
                `مدت زمانی که روی 🎫 ${issueKey} کار کردی را ارسال کن.`,
                "",
                "مثال:",
                "1h 30m",
                "45m",
                "2h",
            ].join("\n"),
            { reply_markup: new InlineKeyboard() },
        );
    });

    bot.callbackQuery(/^worklog-date-today:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1]!;
        await ctx.answerCallbackQuery();
        await handleDateSelection(ctx, stateManager, issueKey, getTodayString());
    });

    bot.callbackQuery(/^worklog-date-yesterday:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1]!;
        await ctx.answerCallbackQuery();
        await handleDateSelection(ctx, stateManager, issueKey, getYesterdayString());
    });

    bot.callbackQuery(/^worklog-date-calendar:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1]!;
        await ctx.answerCallbackQuery();

        const state = stateManager.getState(ctx.from.id);
        const today = getTodayString();

        const jToday = gregorianToJalali(today);
        const calYear = state.worklogCalendarYear ?? jToday.jy;
        const calMonth = state.worklogCalendarMonth ?? jToday.jm;

        stateManager.setState(ctx.from.id, {
            ...state,
            step: "selecting_worklog_date",
            worklogCalendarYear: calYear,
            worklogCalendarMonth: calMonth,
        });

        const calendarKeyboard = buildCalendarKeyboard(calYear, calMonth, undefined, today, issueKey);

        await ctx.editMessageText("📅 انتخاب تاریخ", { reply_markup: calendarKeyboard });
    });

    bot.callbackQuery(/^cal-nav:(\d+):(\d+):(.+)$/, async (ctx) => {
        const year = Number.parseInt(ctx.match[1] ?? "", 10);
        const month = Number.parseInt(ctx.match[2] ?? "", 10);
        const issueKey = ctx.match[3]!;

        await ctx.answerCallbackQuery();

        const state = stateManager.getState(ctx.from.id);
        const today = getTodayString();

        stateManager.setState(ctx.from.id, {
            ...state,
            step: "selecting_worklog_date",
            worklogCalendarYear: year,
            worklogCalendarMonth: month,
        });

        const calendarKeyboard = buildCalendarKeyboard(year, month, state.worklogSelectedDate, today, issueKey);

        await ctx.editMessageText("📅 انتخاب تاریخ", { reply_markup: calendarKeyboard });
    });

    bot.callbackQuery(/^cal-sel:(\d{4}-\d{2}-\d{2}):(.+)$/, async (ctx) => {
        const dateStr = ctx.match[1] ?? "";
        const issueKey = ctx.match[2] ?? "";

        await ctx.answerCallbackQuery();
        await handleDateSelection(ctx, stateManager, issueKey, dateStr);
    });

    bot.callbackQuery(/^cal-today$/, async (ctx) => {
        await ctx.answerCallbackQuery();
        const state = stateManager.getState(ctx.from.id);
        const issueKey = state.issueKey ?? "";
        await handleDateSelection(ctx, stateManager, issueKey, getTodayString());
    });

    bot.callbackQuery(/^worklog-time:(.+):(\d{2}:\d{2})$/, async (ctx) => {
        const issueKey = ctx.match[1] ?? "";
        const timeStr = ctx.match[2] ?? "";

        await ctx.answerCallbackQuery();
        await handleTimeSelection(ctx, stateManager, issueKey, timeStr);
    });

    bot.callbackQuery(/^worklog-time-grid:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1] ?? "";
        await ctx.answerCallbackQuery();

        await ctx.editMessageText(
            ["🕐 انتخاب ساعت", "", "ساعت شروع را انتخاب کن:"].join("\n"),
            { reply_markup: worklogTimeKeyboard(issueKey) },
        );
    });

    bot.callbackQuery(/^worklog-time-manual:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1] ?? "";
        await ctx.answerCallbackQuery();

        const state = stateManager.getState(ctx.from.id);

        stateManager.setState(ctx.from.id, {
            ...state,
            step: "selecting_worklog_time",
        });

        await ctx.editMessageText(
            [
                "🕐 ورود دستی ساعت",
                "",
                "ساعت را به فرمت HH:mm وارد کن:",
                "",
                "مثال:",
                "14:30",
                "09:00",
            ].join("\n"),
            { reply_markup: new InlineKeyboard().text("❌ لغو", `worklog-cancel:${issueKey}`) },
        );
    });

    bot.callbackQuery(/^worklog-confirm:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1] ?? "";

        await ctx.answerCallbackQuery();

        const state = stateManager.getState(ctx.from.id);

        if (!state.worklogDuration || !state.worklogSelectedDate || !state.worklogStartedAt) {
            await ctx.editMessageText("❌ اطلاعات Worklog ناقص است. لطفاً دوباره تلاش کنید.");
            stateManager.clearState(ctx.from.id);
            return;
        }

        if (state.worklogSubmitting) {
            return;
        }

        stateManager.setState(ctx.from.id, {
            ...state,
            worklogSubmitting: true,
        });

        await ctx.editMessageText(
            [
                `🎫 ${issueKey}`,
                "",
                "⏳ در حال ثبت زمان...",
            ].join("\n"),
            { reply_markup: emptyKeyboard() },
        );

        const credentials = await userService.getJiraCredentials(ctx.from.id);
        if (!credentials) {
            await ctx.editMessageText("❌ ابتدا حساب Jira خود را متصل کنید.");
            stateManager.clearState(ctx.from.id);
            return;
        }

        const jiraClient = jiraClientFactory.createForUser(credentials);
        const worklogService = new WorklogService(jiraClient);

        try {
            await worklogService.addWorklog(
                issueKey,
                state.worklogDuration,
                state.worklogStartedAt,
            );

            const fromPage = state.fromPage ?? 1;
            stateManager.clearState(ctx.from.id);

            await ctx.editMessageText(
                [
                    "✅ زمان با موفقیت ثبت شد",
                    "",
                    `🎫 ${issueKey}`,
                    `⏱ ${state.worklogDuration}`,
                ].join("\n"),
                {
                    reply_markup: new InlineKeyboard()
                        .text("◀️ بازگشت به لیست", `back_to_list:${fromPage}`)
                        .row()
                        .text("🏠 منوی اصلی", "back_to_main"),
                },
            );
        } catch (error) {
            const errStatus = axios.isAxiosError(error) ? error.response?.status : "unknown";
            console.error(`Failed to add worklog to ${issueKey}: status=${errStatus}`);
            stateManager.setState(ctx.from.id, {
                ...state,
                worklogSubmitting: false,
            });

            await ctx.editMessageText(
                [`🎫 ${issueKey}`, "", classifyError(error)].join("\n"),
                { reply_markup: worklogPreviewKeyboard(issueKey) },
            );
        }
    });

    bot.callbackQuery(/^worklog-edit:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1] ?? "";
        await ctx.answerCallbackQuery();

        await ctx.editMessageText(
            [
                "✏️ ویرایش Worklog",
                "",
                "کدام بخش را تغییر می‌دهی؟",
            ].join("\n"),
            { reply_markup: worklogEditKeyboard(issueKey) },
        );
    });

    bot.callbackQuery(/^worklog-edit-duration:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1] ?? "";
        await ctx.answerCallbackQuery();

        const state = stateManager.getState(ctx.from.id);

        stateManager.setState(ctx.from.id, {
            ...state,
            step: "waiting_for_worklog_duration",
        });

        await ctx.editMessageText(
            [
                "⏱ ثبت زمان",
                "",
                "مدت زمان جدید را ارسال کن:",
                "",
                "مثال:",
                "1h 30m",
                "45m",
                "2h",
            ].join("\n"),
            { reply_markup: new InlineKeyboard() },
        );
    });

    bot.callbackQuery(/^worklog-edit-date:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1] ?? "";
        await ctx.answerCallbackQuery();

        const state = stateManager.getState(ctx.from.id);
        const today = getTodayString();

        const jToday = gregorianToJalali(today);
        const calYear = state.worklogCalendarYear ?? jToday.jy;
        const calMonth = state.worklogCalendarMonth ?? jToday.jm;

        stateManager.setState(ctx.from.id, {
            ...state,
            step: "selecting_worklog_date",
            worklogCalendarYear: calYear,
            worklogCalendarMonth: calMonth,
        });

        const calendarKeyboard = buildCalendarKeyboard(calYear, calMonth, state.worklogSelectedDate, today, issueKey);

        await ctx.editMessageText("📅 انتخاب تاریخ", { reply_markup: calendarKeyboard });
    });

    bot.callbackQuery(/^worklog-edit-time:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1] ?? "";
        await ctx.answerCallbackQuery();

        const state = stateManager.getState(ctx.from.id);

        stateManager.setState(ctx.from.id, {
            ...state,
            step: "selecting_worklog_time",
        });

        await ctx.editMessageText(
            [
                "🕐 ساعت شروع کار",
                "",
                "ساعت شروع را انتخاب کن:",
            ].join("\n"),
            { reply_markup: worklogTimeKeyboard(issueKey) },
        );
    });

    bot.callbackQuery(/^worklog-edit-back:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1] ?? "";
        await ctx.answerCallbackQuery();
        await showPreview(ctx, stateManager, issueKey);
    });

    bot.callbackQuery(/^worklog-cancel:(.+)$/, async (ctx) => {
        const issueKey = ctx.match[1] ?? "";

        await ctx.answerCallbackQuery();
        const cancelState = stateManager.getState(ctx.from.id);
        stateManager.clearState(ctx.from.id);

        const credentials = await userService.getJiraCredentials(ctx.from.id);
        if (!credentials) {
            await ctx.editMessageText("❌ ابتدا حساب Jira خود را متصل کنید.");
            return;
        }

        try {
            const jiraClient = jiraClientFactory.createForUser(credentials);
            const issueService = new IssueService(jiraClient);
            const issue = await issueService.getIssue(issueKey);

            await ctx.editMessageText(formatIssue(issue), {
                reply_markup: issueDetailKeyboard(issue.key, cancelState.fromPage),
            });
        } catch (error) {
            console.error(`Failed to fetch issue ${issueKey} on worklog cancel`, error);
            await ctx.editMessageText(
                [`🎫 ${issueKey}`, "", "❌ دریافت اطلاعات تسک با خطا مواجه شد."].join("\n"),
            );
        }
    });
}

async function handleDateSelection(
    ctx: Context,
    stateManager: ConversationStateManager,
    issueKey: string,
    dateStr: string,
) {
    const state = stateManager.getState(ctx.from!.id);

    const durationMinutes = state.worklogDurationMinutes ?? 0;
    const now = new Date();

    // Subtract duration from current time to get suggested start time
    let startTime = new Date(now);
    startTime.setMinutes(startTime.getMinutes() - durationMinutes);

    // Apply suggested time to the selected date (handles midnight crossing correctly)
    const suggestedH = String(startTime.getHours()).padStart(2, "0");
    const suggestedM = String(startTime.getMinutes()).padStart(2, "0");
    const combinedDateTime = new Date(`${dateStr}T${suggestedH}:${suggestedM}:00`);
    const startedAt = buildIsoDateTime(combinedDateTime);

    stateManager.setState(ctx.from!.id, {
        ...state,
        step: "selecting_worklog_time",
        worklogSelectedDate: dateStr,
        worklogStartedAt: startedAt,
    });

    const suggestedTime = startTime.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });

    const keyboard = new InlineKeyboard()
        .text(`✅ استفاده از ${suggestedTime}`, `worklog-time:${issueKey}:${suggestedTime}`)
        .row()
        .text("🕐 انتخاب ساعت", `worklog-time-grid:${issueKey}`)
        .text("❌ لغو", `worklog-cancel:${issueKey}`);

    await ctx.editMessageText(
        [
            "🕐 ساعت شروع کار",
            "",
            `پیشنهاد سیستم:`,
            suggestedTime,
            "",
            `اگر این ساعت درست است، روی آن کلیک کن.`,
        ].join("\n"),
        { reply_markup: keyboard },
    );
}

async function handleTimeSelection(
    ctx: Context,
    stateManager: ConversationStateManager,
    issueKey: string,
    timeStr: string,
) {
    const state = stateManager.getState(ctx.from!.id);
    const dateStr = state.worklogSelectedDate ?? getTodayString();

    const [hoursStr, minutesStr] = timeStr.split(":");
    const hours = Number.parseInt(hoursStr ?? "0", 10);
    const minutes = Number.parseInt(minutesStr ?? "0", 10);

    const startTime = new Date(`${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
    const startedAt = buildIsoDateTime(startTime);

    stateManager.setState(ctx.from!.id, {
        ...state,
        step: "confirm_worklog",
        worklogStartedAt: startedAt,
    });

    await showPreview(ctx, stateManager, issueKey);
}

async function showPreview(
    ctx: Context,
    stateManager: ConversationStateManager,
    issueKey: string,
) {
    const state = stateManager.getState(ctx.from!.id);

    if (!state.worklogDuration || !state.worklogSelectedDate || !state.worklogStartedAt) {
        await ctx.editMessageText("❌ اطلاعات Worklog ناقص است. لطفاً دوباره تلاش کنید.");
        stateManager.clearState(ctx.from!.id);
        return;
    }

    const startedDateTime = new Date(state.worklogStartedAt);
    const timeStr = startedDateTime.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });

    const previewText = [
        "⏱ پیش‌نمایش ثبت زمان",
        "",
        `🎫 ${issueKey}`,
        "",
        `📅 تاریخ: ${formatDatePersian(state.worklogSelectedDate)}`,
        `🕐 شروع: ${timeStr}`,
        `⏱ مدت: ${state.worklogDuration}`,
        "",
        "آیا این زمان ثبت شود؟",
    ].join("\n");

    await ctx.editMessageText(previewText, {
        reply_markup: worklogPreviewKeyboard(issueKey),
    });
}

function buildIsoDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const ms = String(date.getMilliseconds()).padStart(3, "0");

    // Jira Server uses Java SimpleDateFormat Z pattern: +HHMM (no colon).
    // ISO 8601 format +HH:MM is rejected with a 500 parse error.
    const rawOffset = -date.getTimezoneOffset();
    const sign = rawOffset >= 0 ? "+" : "-";
    const absOffset = Math.abs(rawOffset);
    const tzHours = String(Math.floor(absOffset / 60)).padStart(2, "0");
    const tzMins = String(absOffset % 60).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${sign}${tzHours}${tzMins}`;
}
