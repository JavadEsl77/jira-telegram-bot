/**
 * ابزارهای کمکی برای کار با timezone.
 * پیش‌فرض: Asia/Tehran (مناسب برای تیم فارسی‌زبان و Jira ایرانی)
 * می‌تواند با متغیر محیطی APP_TIMEZONE تغییر کند.
 */

/**
 * timezone پیش‌فرض برای پروژه را برمی‌گرداند.
 * اول APP_TIMEZONE را بررسی می‌کند، سپس system timezone، و در نهایت Asia/Tehran.
 */
export function getDefaultTimezone(): string {
    const envTz = process.env.APP_TIMEZONE;
    if (envTz && isValidTimezone(envTz)) {
        return envTz;
    }

    try {
        const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (systemTz && isValidTimezone(systemTz)) {
            return systemTz;
        }
    } catch {
        // Intl might not be available in some environments
    }

    return "Asia/Tehran";
}

/**
 * offset timezone را برای یک تاریخ مشخص محاسبه می‌کند.
 * @param timezone - شناسه timezone (مثلاً "Asia/Tehran")
 * @param date - تاریخ مورد نظر
 * @returns رشته offset مثل "+03:30" یا "-04:00"
 */
export function getTimezoneOffset(timezone: string, date: Date): string {
    const utcString = date.toLocaleString("en-US", { timeZone: "UTC" });
    const tzString = date.toLocaleString("en-US", { timeZone: timezone });

    const utcDate = new Date(utcString);
    const tzDate = new Date(tzString);

    const offsetMinutes = (tzDate.getTime() - utcDate.getTime()) / 60000;

    const hours = Math.floor(Math.abs(offsetMinutes) / 60);
    const minutes = Math.abs(offsetMinutes) % 60;
    const sign = offsetMinutes >= 0 ? "+" : "-";

    return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function isValidTimezone(tz: string): boolean {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}
