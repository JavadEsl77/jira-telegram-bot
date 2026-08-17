import { InlineKeyboard } from "grammy";

export function settingsKeyboard() {
    return new InlineKeyboard()
        .text("🔐 اتصال Jira", "connect_jira")
        .row()
        .text("❌ قطع اتصال Jira", "disconnect_jira")
        .row()
        .text("📄 تعداد تسک در هر صفحه", "set_page_size")
        .row()
        .text("◀️ بازگشت", "back_to_main");
}
