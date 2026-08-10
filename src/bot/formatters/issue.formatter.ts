import type { JiraIssue } from "../../jira/jira.types.js";

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
 * هدر صفحه‌بندی‌شده لیست Issue‌ها را فرمت می‌کند.
 * @param issues - آرایه Issue‌های صفحه جاری
 * @param page - شماره صفحه جاری
 * @param totalPages - تعداد کل صفحات
 */
export function formatIssueList(
    issues: JiraIssue[],
    page: number,
    totalPages: number,
): string {
    if (issues.length === 0) {
        return [
            "📋 تسک‌های من",
            "",
            "تسکی برای نمایش پیدا نشد.",
        ].join("\n");
    }

    return [
        "📋 تسک‌های من",
        "",
        `تعداد کل: ${issues.length}`,
        `صفحه ${page} از ${totalPages}`,
    ].join("\n");
}
