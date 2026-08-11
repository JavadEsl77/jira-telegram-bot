import { InlineKeyboard } from "grammy";

/**
 * کیبورد انتخاب تاریخ برای Worklog.
 */
export function worklogDateKeyboard(issueKey: string) {
    return new InlineKeyboard()
        .text("📅 امروز", `worklog-date-today:${issueKey}`)
        .text("📅 دیروز", `worklog-date-yesterday:${issueKey}`)
        .row()
        .text("🗓 انتخاب تاریخ", `worklog-date-calendar:${issueKey}`)
        .text("❌ لغو", `worklog-cancel:${issueKey}`);
}

/**
 * کیبورد ناوبری تقویم (ماه قبل/بعد).
 */
export function worklogCalendarNavKeyboard(year: number, month: number, issueKey: string) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;

    return new InlineKeyboard()
        .text("‹", `cal-nav:${prevYear}:${prevMonth}:${issueKey}`)
        .text("🗓 انتخاب تاریخ", "noop")
        .text("›", `cal-nav:${nextYear}:${nextMonth}:${issueKey}`)
        .row();
}

/**
 * کیبورد انتخاب ساعت با interval ۱۵ دقیقه‌ای.
 */
export function worklogTimeKeyboard(issueKey: string) {
    const keyboard = new InlineKeyboard();

    for (let hour = 0; hour < 24; hour++) {
        const time1 = `${String(hour).padStart(2, "0")}:00`;
        const time2 = `${String(hour).padStart(2, "0")}:30`;

        keyboard.text(time1, `worklog-time:${issueKey}:${time1}`).text(time2, `worklog-time:${issueKey}:${time2}`).row();
    }

    keyboard.text("✏️ ورود دستی", `worklog-time-manual:${issueKey}`).text("❌ لغو", `worklog-cancel:${issueKey}`).row();

    return keyboard;
}

/**
 * کیبورد پیش‌نمایش Worklog.
 */
export function worklogPreviewKeyboard(issueKey: string) {
    return new InlineKeyboard()
        .text("✅ ثبت زمان", `worklog-confirm:${issueKey}`)
        .text("✏️ ویرایش", `worklog-edit:${issueKey}`)
        .row()
        .text("❌ لغو", `worklog-cancel:${issueKey}`);
}

/**
 * کیبورد ویرایش Worklog.
 */
export function worklogEditKeyboard(issueKey: string) {
    return new InlineKeyboard()
        .text("⏱ تغییر مدت زمان", `worklog-edit-duration:${issueKey}`)
        .text("📅 تغییر تاریخ", `worklog-edit-date:${issueKey}`)
        .row()
        .text("🕐 تغییر ساعت", `worklog-edit-time:${issueKey}`)
        .text("◀️ بازگشت به تأیید", `worklog-edit-back:${issueKey}`)
        .row();
}

/**
 * کیبورد خالی برای hiding دکمه‌ها در حین ثبت.
 */
export function emptyKeyboard() {
    return new InlineKeyboard();
}
