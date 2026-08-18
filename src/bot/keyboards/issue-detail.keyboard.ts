import { InlineKeyboard } from "grammy";

export function issueDetailKeyboard(
    issueKey: string,
    fromPage = 1,
    backCallback = `back_to_list:${fromPage}`,
) {
    return new InlineKeyboard()
        .text("🔄 تغییر وضعیت", `transition:${issueKey}`)
        .row()
        .text("💬 کامنت", `comment:${issueKey}`)
        .text("⏱ ثبت زمان", `worklog:${issueKey}`)
        .row()
        .text("◀️ بازگشت به لیست", backCallback);
}