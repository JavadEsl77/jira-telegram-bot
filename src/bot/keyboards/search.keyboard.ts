import { InlineKeyboard } from "grammy";

/** کیبورد ناوبری نتایج جستجو — قبلی/بعدی، جستجوی جدید و منوی اصلی */
export function searchResultsKeyboard(page: number, totalPages: number) {
    const keyboard = new InlineKeyboard();

    if (totalPages > 1) {
        if (page > 1) {
            keyboard.text("◀️ قبلی", `search_page:${page - 1}`);
        }

        if (page < totalPages) {
            keyboard.text("بعدی ▶️", `search_page:${page + 1}`);
        }

        keyboard.row();
    }

    keyboard.text("🔎 جستجوی جدید", "search_tasks").row();
    keyboard.text("🏠 منوی اصلی", "back_to_main");

    return keyboard;
}

/** کیبورد حالت «نتیجه‌ای پیدا نشد» */
export function searchNoResultsKeyboard() {
    return new InlineKeyboard()
        .text("🔎 جستجوی جدید", "search_tasks")
        .row()
        .text("🏠 منوی اصلی", "back_to_main");
}
