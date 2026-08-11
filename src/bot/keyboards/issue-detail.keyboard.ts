import { InlineKeyboard } from "grammy";

export function issueDetailKeyboard(issueKey: string, fromPage = 1) {
    return new InlineKeyboard()
        .text("🔄 تغییر وضعیت", `transition:${issueKey}`)
        .row()
        .text("💬 کامنت", `comment:${issueKey}`)
        .text("⏱ ثبت زمان", `worklog:${issueKey}`)
        .row()
        .text("◀️ بازگشت", `my_tasks:${fromPage}`);
}