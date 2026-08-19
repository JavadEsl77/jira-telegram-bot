import { InlineKeyboard } from "grammy";

export function mainKeyboard() {
    return new InlineKeyboard()
        .text("📋 تسک‌های من", "my_tasks")
        .row()
        .text("🔍 جستجوی تسک", "search_tasks")
        .row()
        .text("➕ ایجاد تسک", "create_issue")
        .row()
        .text("🗑 حذف تسک", "delete_issue")
        .row()
        .text("⚙️ تنظیمات", "settings");
}
