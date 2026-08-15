import { InlineKeyboard } from "grammy";

/** کیبورد کارت تکی Issue — دکمه «مشاهده تسک» برای باز کردن جزئیات */
export function issueCardKeyboard(issueKey: string, page: number) {
    return new InlineKeyboard()
        .text("👁 مشاهده تسک", `issue:${issueKey}:${page}`);
}

/** کیبورد ناوبری صفحه‌بندی — قبلی/بعدی و منوی اصلی */
export function paginationKeyboard(page: number, totalPages: number) {
    const keyboard = new InlineKeyboard();

    if (totalPages > 1) {
        if (page > 1) {
            keyboard.text("◀️ قبلی", `my_tasks:${page - 1}`);
        }

        if (page < totalPages) {
            keyboard.text("بعدی ▶️", `my_tasks:${page + 1}`);
        }

        keyboard.row();
    }

    keyboard.text("🏠 منوی اصلی", "back_to_main");

    return keyboard;
}
