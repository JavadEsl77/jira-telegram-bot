import { InlineKeyboard } from "grammy";

/**
 * کیبورد صفحه Issue Detail.
 * @param issueKey - کلید Issue
 * @param jiraUrl - لینک مستقیم Issue در Jira (برای دکمه URL)
 * @param hasDescription - اگر true باشد، دکمه «توضیحات کامل» نمایش داده می‌شود
 * @param fromPage - شماره صفحه‌ای که کاربر از آن وارد شده (برای بازگشت)
 * @param backCallback - callback دکمه بازگشت (پیش‌فرض: بازگشت به My Tasks)
 */
export function issueDetailKeyboard(
    issueKey: string,
    jiraUrl: string,
    hasDescription: boolean,
    fromPage = 1,
    backCallback = `back_to_list:${fromPage}`,
) {
    const keyboard = new InlineKeyboard()
        .text("🔄 تغییر وضعیت", `transition:${issueKey}`)
        .row()
        .text("💬 کامنت", `comment:${issueKey}`)
        .text("⏱ ثبت زمان", `worklog:${issueKey}`)
        .row();

    if (hasDescription) {
        keyboard.text("📝 توضیحات کامل", `issue-desc:${issueKey}`);
    }

    keyboard
        .text("💬 مشاهده کامنت‌ها", `issue-comments:${issueKey}`)
        .row()
        .url("🔗 باز کردن در Jira", jiraUrl)
        .row()
        .text("◀️ بازگشت به لیست", backCallback);

    return keyboard;
}