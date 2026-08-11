/**
 * ابزارهای تقویم شمسی (Jalali) برای تولید Inline Keyboard تقویم در Telegram.
 *
 * از کتابخانه jalaali-js برای تبدیل تاریخ‌ها استفاده می‌شود.
 */

import { InlineKeyboard } from "grammy";
import { toJalaali, toGregorian, jalaaliMonthLength } from "jalaali-js";

const PERSIAN_MONTH_NAMES = [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
];

const PERSIAN_DAY_NAMES = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export interface CalendarState {
    year: number;
    month: number;
    selectedDate?: string;
}

/**
 * یک Inline Keyboard تقویم شمسی تولید می‌کند (با ناوبری ماه).
 *
 * @param year - سال شمسی جاری
 * @param month - ماه شمسی جاری (۱-۱۲)
 * @param selectedDate - تاریخ انتخاب‌شده به فرمت YYYY-MM-DD (میلادی) یا undefined
 * @param today - تاریخ امروز به فرمت YYYY-MM-DD (میلادی)
 * @param issueKey - کلید Issue برای callback ناوبری
 */
export function buildCalendarKeyboard(
    year: number,
    month: number,
    selectedDate: string | undefined,
    today: string,
    issueKey: string,
): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;

    keyboard.text("‹", `cal-nav:${prevYear}:${prevMonth}:${issueKey}`);
    keyboard.text("🗓 انتخاب تاریخ", "noop");
    keyboard.text("›", `cal-nav:${nextYear}:${nextMonth}:${issueKey}`);
    keyboard.row();

    const daysInMonth = jalaaliMonthLength(year, month);
    const firstDayJalaali = { jy: year, jm: month, jd: 1 };
    const firstDayGregorian = toGregorian(firstDayJalaali.jy, firstDayJalaali.jm, firstDayJalaali.jd);
    const firstDayJs = new Date(firstDayGregorian.gy, firstDayGregorian.gm - 1, firstDayGregorian.gd);
    let startDayOfWeek = firstDayJs.getDay();
    startDayOfWeek = (startDayOfWeek + 1) % 7;

    keyboard.text(`${PERSIAN_MONTH_NAMES[month - 1]} ${year}`, "noop").row();

    const headerRow = keyboard;
    for (const dayName of PERSIAN_DAY_NAMES) {
        headerRow.text(dayName, "noop");
    }
    headerRow.row();

    let dayCounter = 1;
    const totalCells = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;

    for (let cell = 0; cell < totalCells; cell++) {
        if (cell < startDayOfWeek || dayCounter > daysInMonth) {
            keyboard.text(" ", "noop");
        } else {
            const gregorian = toGregorian(year, month, dayCounter);
            const dateStr = formatDate(gregorian.gy, gregorian.gm, gregorian.gd);
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === today;
            const isFuture = isFutureDate(dateStr, today);

            let label = String(dayCounter);
            if (isToday) label += " ✓";
            if (isSelected) label = `▸${dayCounter}`;

            const callbackData = isFuture ? "noop" : `cal-sel:${dateStr}:${issueKey}`;
            keyboard.text(label, callbackData);
            dayCounter++;
        }

        if ((cell + 1) % 7 === 0) {
            keyboard.row();
        }
    }

    keyboard.text("📅 امروز", "cal-today").text("❌ لغو", `worklog-cancel:${issueKey}`).row();

    return keyboard;
}

/**
 * تاریخ امروز به فرمت YYYY-MM-DD (میلادی) برمی‌گرداند.
 */
export function getTodayString(): string {
    const now = new Date();
    return formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * yesterday به فرمت YYYY-MM-DD (میلادی) برمی‌گرداند.
 */
export function getYesterdayString(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDate(
        yesterday.getFullYear(),
        yesterday.getMonth() + 1,
        yesterday.getDate(),
    );
}

/**
 * Jalali year/month را به نام ماه فارسی تبدیل می‌کند.
 */
export function getPersianMonthName(month: number): string {
    return PERSIAN_MONTH_NAMES[month - 1] || "";
}

/**
 * بررسی می‌کند آیا تاریخ在未来 است.
 */
function isFutureDate(dateStr: string, today: string): boolean {
    return dateStr > today;
}

function formatDate(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * یک رشته تاریخ شمسی به میلادی تبدیل می‌کند.
 */
export function jalaliToGregorian(jy: number, jm: number, jd: number): string {
    const g = toGregorian(jy, jm, jd);
    return formatDate(g.gy, g.gm, g.gd);
}

/**
 * یک رشته تاریخ میلادی به شمسی تبدیل می‌کند.
 */
export function gregorianToJalali(dateStr: string): { jy: number; jm: number; jd: number } {
    const parts = dateStr.split("-");
    const year = Number.parseInt(parts[0] ?? "", 10);
    const month = Number.parseInt(parts[1] ?? "", 10);
    const day = Number.parseInt(parts[2] ?? "", 10);
    return toJalaali(year, month, day);
}
