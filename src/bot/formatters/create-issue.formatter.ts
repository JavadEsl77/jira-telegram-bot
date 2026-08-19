import { getPriorityEmoji } from "./issue.formatter.js";

/** داده‌های جمع‌آوری‌شده جریان ایجاد تسک — برای Preview */
export interface CreateIssueDraft {
    typeName?: string;
    summary?: string;
    description?: string;
    priorityName?: string;
    assigneeDisplayName?: string;
    estimate?: string;
    labels?: string[];
}

/**
 * صفحه پیش‌نمایش تسک جدید را پیش از ایجاد فرمت می‌کند.
 * @param draft - اطلاعات جمع‌آوری‌شده در جریان ایجاد تسک
 * @param creatorDisplayName - نام کاربر Telegram متصل (فقط برای نمایش — Jira خودش Creator را تعیین می‌کند)
 */
export function formatCreateIssuePreview(
    draft: CreateIssueDraft,
    creatorDisplayName: string,
): string {
    return [
        "📝 بررسی تسک جدید",
        "",
        `📌 نوع: ${draft.typeName ?? "نامشخص"}`,
        "",
        `🎫 عنوان: ${draft.summary ?? ""}`,
        "",
        `📄 توضیحات: ${draft.description ? draft.description : "بدون توضیحات"}`,
        "",
        `⚡ اولویت: ${draft.priorityName ? `${getPriorityEmoji(draft.priorityName)} ${draft.priorityName}` : "بدون اولویت"}`,
        "",
        `👤 مسئول: ${draft.assigneeDisplayName ?? "بدون مسئول"}`,
        "",
        `⏱ Estimate: ${draft.estimate ?? "بدون Estimate"}`,
        "",
        `🏷 Labels: ${draft.labels && draft.labels.length > 0 ? draft.labels.join(", ") : "بدون Label"}`,
        "",
        `👤 سازنده: ${creatorDisplayName}`,
    ].join("\n");
}

/**
 * پیام موفقیت پس از ایجاد Issue را فرمت می‌کند.
 * @param issueKey - کلید واقعی Issue ایجادشده (از پاسخ Jira)
 * @param summary - عنوان تسک
 */
export function formatCreateIssueSuccess(issueKey: string, summary: string): string {
    return ["✅ تسک با موفقیت ایجاد شد.", "", `🎫 ${issueKey}`, "", summary].join("\n");
}
