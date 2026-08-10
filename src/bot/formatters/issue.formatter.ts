import type { JiraIssue } from "../../jira/jira.types.js";

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