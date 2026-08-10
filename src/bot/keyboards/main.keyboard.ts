import { InlineKeyboard } from "grammy";

export function mainKeyboard() {
    return new InlineKeyboard()
        .text("📋 تسک‌های من", "my_tasks")
        .row()
        .text("🔍 جستجوی تسک", "search_tasks")
        .row()
        .text("⚙️ تنظیمات", "settings");
}
