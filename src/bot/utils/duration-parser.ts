/**
 * پارسری برای مقادیر مدت زمان به فرمت‌های قابل قبول Jira.
 *
 * فرمت‌های پشتیبانی شده:
 * - 30m, 45m, 90m
 * - 1h, 2h, 3h
 * - 1h 30m, 2h 15m, 1d 2h
 * - 1h30m, 2h15m (بدون فاصله)
 * - 1d, 2d (۱ روز = ۸ ساعت کاری، اما برای ثبت worklog روز = ۲۴ ساعت)
 *
 * محدودیت‌ها:
 * - حداکثر ۲۴ ساعت (۱۴۴۰ دقیقه)
 * - باید بیشتر از صفر باشد
 * - واحدهای مجاز: h (ساعت), m (دقیقه), d (روز = ۲۴ ساعت)
 */

export interface ParsedDuration {
    hours: number;
    minutes: number;
    totalMinutes: number;
}

const MAX_TOTAL_MINUTES = 24 * 60;

/**
 * یک مقدار مدت زمان را پارس می‌کند و به ساعت/دقیقه تبدیل می‌کند.
 * @param input - رشته ورودی (مثلاً "1h 30m")
 * @returns آبجکت ParsedDuration در صورت موفقیت، null در صورت خطا
 */
export function parseDuration(input: string): ParsedDuration | null {
    const trimmed = input.trim().toLowerCase();

    if (!trimmed) return null;

    const tokens = tokenize(trimmed);
    if (!tokens) return null;

    let totalMinutes = 0;

    for (const token of tokens) {
        const value = token.value;
        const unit = token.unit;

        if (unit === "d") {
            totalMinutes += value * 24 * 60;
        } else if (unit === "h") {
            totalMinutes += value * 60;
        } else if (unit === "m") {
            totalMinutes += value;
        }
    }

    if (totalMinutes <= 0) return null;
    if (totalMinutes > MAX_TOTAL_MINUTES) return null;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return { hours, minutes, totalMinutes };
}

interface Token {
    value: number;
    unit: string;
}

function tokenize(input: string): Token[] | null {
    const tokens: Token[] = [];
    const regex = /^(\d+)([hmsd])/i;

    let remaining = input.replace(/\s+/g, "");

    while (remaining.length > 0) {
        const match = remaining.match(regex);
        if (!match) return null;

        tokens.push({
            value: Number.parseInt(match[1]!, 10),
            unit: match[2]!.toLowerCase(),
        });

        remaining = remaining.slice(match[0].length);
    }

    if (tokens.length === 0) return null;

    return tokens;
}

/**
 * مدت زمان به رشته قابل نمایش برای Jira تبدیل می‌شود.
 * @param duration - آبجکت ParsedDuration
 * @returns رشته مثل "1h 30m"
 */
export function formatDuration(duration: ParsedDuration): string {
    const parts: string[] = [];

    if (duration.hours > 0) {
        parts.push(`${duration.hours}h`);
    }

    if (duration.minutes > 0) {
        parts.push(`${duration.minutes}m`);
    }

    return parts.join(" ");
}

/**
 * بررسی می‌کند آیا ورودی به صورت duration است یا خیر.
 * @param input - رشته ورودی
 */
export function looksLikeDuration(input: string): boolean {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return false;
    return /^\d/.test(trimmed) && /[hmsd]/.test(trimmed);
}

/** حداکثر مقدار مجاز برای Original Estimate — ۶۰ روز، فقط یک سقف منطقی برای جلوگیری از ورودی نامعقول */
const MAX_ESTIMATE_MINUTES = 60 * 24 * 60;

/**
 * ورودی Original Estimate را پارس و به فرمت «pretty duration» موردقبول Jira
 * (مثلاً "1d 2h", "2h", "30m") نرمالایز می‌کند. برخلاف {@link parseDuration}
 * سقف ۲۴ ساعته ندارد، چون Original Estimate می‌تواند چند روزه باشد.
 * @param input - رشته ورودی (مثلاً "1h 30m"، "3h"، "2d")
 * @returns رشته نرمالایزشده در صورت موفقیت، null در صورت خطا
 */
export function parseEstimate(input: string): string | null {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return null;

    const tokens = tokenize(trimmed);
    if (!tokens) return null;

    let totalMinutes = 0;

    for (const token of tokens) {
        if (token.unit === "d") totalMinutes += token.value * 24 * 60;
        else if (token.unit === "h") totalMinutes += token.value * 60;
        else if (token.unit === "m") totalMinutes += token.value;
    }

    if (totalMinutes <= 0) return null;
    if (totalMinutes > MAX_ESTIMATE_MINUTES) return null;

    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(" ");
}
