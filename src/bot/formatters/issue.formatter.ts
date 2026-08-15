import type { JiraIssue } from "../../jira/jira.types.js";

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatRelativeDateEn(date?: string): string {
    if (!date) return "unknown";

    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    return new Date(date).toLocaleDateString("en-US");
}

/**
 * تاریخ را به فرمت نسبی فارسی تبدیل می‌کند.
 * مثال: "۵ دقیقه پیش"، "۲ ساعت پیش"، "۳ روز پیش"
 */
function formatRelativeDate(date?: string): string {
    if (!date) {
        return "نامشخص";
    }

    const diff =
        Date.now() - new Date(date).getTime();

    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) {
        return "همین الان";
    }

    if (minutes < 60) {
        return `${minutes} دقیقه پیش`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours} ساعت پیش`;
    }

    const days = Math.floor(hours / 24);

    if (days < 7) {
        return `${days} روز پیش`;
    }

    return new Date(date).toLocaleDateString("fa-IR");
}

/** ایموجی متناسب با وضعیت Issue را برمی‌گرداند */
function getStatusEmoji(status?: string): string {
    switch (status?.toLowerCase()) {
        case "done":
            return "🟢";

        case "in progress":
            return "🟡";

        case "code review":
            return "🔵";

        case "q/a":
            return "🟣";

        case "pend":
            return "🟠";

        default:
            return "⚪";
    }
}

/** ایموجی متناسب با اولویت Issue را برمی‌گرداند */
function getPriorityEmoji(priority?: string): string {
    switch (priority?.toLowerCase()) {
        case "highest":
            return "🔴";

        case "high":
            return "🟠";

        case "medium":
            return "🟡";

        case "low":
            return "🟢";

        case "lowest":
            return "🔵";

        default:
            return "⚪";
    }
}

/**
 * یک Issue را به متن کامل برای نمایش در Telegram فرمت می‌کند.
 * شامل: کلید، عنوان، وضعیت، اولویت، مسئول، برچسب‌ها و زمان به‌روزرسانی.
 * @param issue - Issue دریافت‌شده از Jira
 */
export function formatIssue(issue: JiraIssue): string {
    const status = issue.fields.status?.name;
    const priority = issue.fields.priority?.name;
    const assignee =
        issue.fields.assignee?.displayName;

    const labels = issue.fields.labels ?? [];

    const lines = [
        `🎫 ${issue.key}`,
        "",
        `📝 ${issue.fields.summary}`,
        "",
        `${getStatusEmoji(status)} وضعیت: ${status ?? "نامشخص"
        }`,
        `${getPriorityEmoji(priority)} اولویت: ${priority ?? "نامشخص"
        }`,
    ];

    if (assignee) {
        lines.push(`👤 مسئول: ${assignee}`);
    }

    if (labels.length > 0) {
        lines.push(`🏷 ${labels.join(", ")}`);
    }

    lines.push(
        `🕐 بروزرسانی: ${formatRelativeDate(
            issue.fields.updated,
        )}`,
    );

    return lines.join("\n");
}

/**
 * یک Issue را به کارت فشرده برای نمایش در لیست فرمت می‌کند.
 * فشرده‌تر از formatIssue — مناسب برای نمایش چند Issue در یک پیام.
 * @param issue - Issue دریافت‌شده از Jira
 */
export function formatIssueCard(
    issue: JiraIssue,
): string {
    const status = issue.fields.status?.name;
    const priority = issue.fields.priority?.name;
    const assignee =
        issue.fields.assignee?.displayName;

    const labels = issue.fields.labels ?? [];

    const lines = [
        `🎫 ${issue.key}`,
        issue.fields.summary,
        "",
        `${getStatusEmoji(status)} ${status ?? "نامشخص"}`,
        `${getPriorityEmoji(priority)} ${priority ?? "نامشخص"}`,
    ];

    if (assignee) {
        lines.push(`👤 ${assignee}`);
    }

    if (labels.length > 0) {
        lines.push(`🏷 ${labels.join(", ")}`);
    }

    lines.push(
        `🕐 بروزرسانی: ${formatRelativeDate(
            issue.fields.updated,
        )}`,
    );

    return lines.join("\n");
}

/**
 * کارت مینیمال یک Issue برای نمایش در لیست «تسک‌های من».
 * فقط: کلید، عنوان، لینک Jira، وضعیت، آخرین بروزرسانی.
 * خروجی HTML است — هنگام ارسال باید parse_mode: "HTML" تنظیم شود.
 * @param issue - Issue دریافت‌شده از Jira
 * @param jiraBaseUrl - آدرس پایه Jira (بدون slash انتهایی)
 */
export function formatIssueCardMinimal(issue: JiraIssue, jiraBaseUrl: string): string {
    const status = issue.fields.status?.name;
    const jiraUrl = `${jiraBaseUrl}/browse/${issue.key}`;

    return [
        `🎫 ${escapeHtml(issue.key)}`,
        "",
        escapeHtml(issue.fields.summary),
        "",
        `<a href="${jiraUrl}">🔗 View in Jira</a>`,
        `${getStatusEmoji(status)} ${escapeHtml(status ?? "Unknown")}`,
        `🕐 ${formatRelativeDateEn(issue.fields.updated)}`,
    ].join("\n");
}

/**
 * هدر صفحه‌بندی‌شده لیست Issue‌ها را فرمت می‌کند.
 * @param total - تعداد کل Issue‌ها (از Jira)
 * @param page - شماره صفحه جاری
 * @param totalPages - تعداد کل صفحات
 */
export function formatIssueList(
    total: number,
    page: number,
    totalPages: number,
): string {
    return [
        "📋 تسک‌های من",
        "",
        `تعداد کل: ${total}`,
        `صفحه ${page} از ${totalPages}`,
    ].join("\n");
}
