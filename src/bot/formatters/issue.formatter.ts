import type { JiraComment, JiraIssue } from "../../jira/jira.types.js";
import { gregorianToJalali, getPersianMonthName } from "../utils/calendar.js";

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** متن را در صورت عبور از حد مشخص کوتاه می‌کند تا هرگز باعث شکست ارسال پیام تلگرام نشود */
function truncateText(text: string, maxLength: number): string {
    const trimmed = text.trim();
    if (trimmed.length <= maxLength) return trimmed;
    return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

/**
 * توضیحات/کامنت Jira را که گاهی به‌صورت HTML (مثلاً از ویرایشگر Rich Text) برمی‌گردد،
 * به متن ساده تبدیل می‌کند — تگ‌های خط‌جدید به newline و بقیه تگ‌ها حذف می‌شوند.
 */
function stripHtml(text: string): string {
    return text
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<li[^>]*>/gi, "• ")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;/gi, "'")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/** تاریخ میلادی را به فرمت عددی شمسی «YYYY/MM/DD» تبدیل می‌کند */
function formatJalaliNumeric(date: Date): string {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const { jy, jm, jd } = gregorianToJalali(dateStr);
    return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
}

/** تاریخ میلادی را به فرمت شمسی «روز ماه سال» تبدیل می‌کند */
function formatJalaliPersian(date: Date): string {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const { jy, jm, jd } = gregorianToJalali(dateStr);
    return `${jd} ${getPersianMonthName(jm)} ${jy}`;
}

/** رشته تاریخ (بدون زمان، فرمت YYYY-MM-DD) مثل duedate را به شمسی عددی تبدیل می‌کند */
function formatDateOnlyJalali(dateStr: string): string {
    const { jy, jm, jd } = gregorianToJalali(dateStr);
    return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
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

    return formatJalaliNumeric(new Date(date));
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

    return formatJalaliPersian(new Date(date));
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

/** حداکثر طول پیش‌نمایش توضیحات/آخرین کامنت در صفحه Summary تسک */
const DETAIL_PREVIEW_MAX = 200;

/**
 * یک Issue را به متن کامل (Summary سطح اول) برای نمایش در Telegram فرمت می‌کند.
 * شامل: کلید، عنوان، وضعیت، اولویت، نوع، افراد، برچسب‌ها، تاریخ‌ها، خلاصه توضیحات و آخرین کامنت.
 * جزئیات طولانی (توضیحات کامل/همه کامنت‌ها) در صفحات جداگانه نمایش داده می‌شوند.
 * @param issue - Issue دریافت‌شده از Jira
 */
export function formatIssue(issue: JiraIssue): string {
    const status = issue.fields.status?.name;
    const priority = issue.fields.priority?.name;
    const assignee = issue.fields.assignee?.displayName;
    const creator = issue.fields.creator?.displayName ?? issue.fields.reporter?.displayName;
    const issueType = issue.fields.issuetype?.name;
    const labels = issue.fields.labels ?? [];

    const lines = [
        `🎫 شماره تسک: ${issue.key}`,
        "",
        `📝 عنوان: ${issue.fields.summary}`,
        "",
        `${getStatusEmoji(status)} وضعیت: ${status ?? "نامشخص"}`,
        `${getPriorityEmoji(priority)} اولویت: ${priority ?? "نامشخص"}`,
    ];

    if (issueType) {
        lines.push(`📌 نوع: ${issueType}`);
    }

    lines.push("");

    if (assignee) {
        lines.push(`👤 مسئول: ${assignee}`);
    }

    if (creator) {
        lines.push(`👤 ایجادکننده: ${creator}`);
    }

    if (labels.length > 0) {
        lines.push("", `🏷 برچسب‌ها: ${labels.join(", ")}`);
    }

    lines.push("");

    if (issue.fields.created) {
        lines.push(`📅 ایجاد شده: ${formatJalaliPersian(new Date(issue.fields.created))}`);
    }

    lines.push(`🕐 بروزرسانی: ${formatRelativeDate(issue.fields.updated)}`);

    if (issue.fields.duedate) {
        lines.push(`📅 سررسید: ${formatDateOnlyJalali(issue.fields.duedate)}`);
    }

    const description =
        typeof issue.fields.description === "string" ? stripHtml(issue.fields.description) : "";

    if (description) {
        lines.push("", "📝 توضیحات:", truncateText(description, DETAIL_PREVIEW_MAX));
    }

    const lastComment = issue.fields.comment?.comments.at(-1);

    if (lastComment) {
        lines.push(
            "",
            "💬 آخرین کامنت:",
            `👤 نویسنده: ${lastComment.author?.displayName ?? "ناشناس"}`,
            truncateText(stripHtml(lastComment.body), DETAIL_PREVIEW_MAX),
        );
    }

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
const CARD_WIDTH_CHARS = 30;
const CARD_MAX_SUMMARY_LINES = 3;
const CARD_SEPARATOR = "┈".repeat(26);

/**
 * عنوان Issue را در عرض ثابت می‌شکند تا کارت از حد معینی بزرگ‌تر نشود.
 * خط‌ها حداکثر CARD_WIDTH_CHARS کاراکتر هستند و در صورت عبور از CARD_MAX_SUMMARY_LINES خط، با «…» کوتاه می‌شوند.
 */
function wrapSummary(summary: string, maxChars: number, maxLines: number): string {
    const words = summary.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;

        if (candidate.length > maxChars) {
            if (current) lines.push(current);
            current = word.length > maxChars ? word.slice(0, maxChars) : word;
        } else {
            current = candidate;
        }

        if (lines.length === maxLines) break;
    }

    if (lines.length < maxLines && current) lines.push(current);

    const truncated = words.join(" ").length > lines.join(" ").length;
    const lastLine = lines[lines.length - 1];
    if (truncated && lastLine) {
        lines[lines.length - 1] = lastLine.slice(0, maxChars - 1) + "…";
    }

    return lines.join("\n");
}

export function formatIssueCardMinimal(issue: JiraIssue, jiraBaseUrl: string): string {
    const status = issue.fields.status?.name;
    const jiraUrl = `${jiraBaseUrl}/browse/${issue.key}`;
    const summary = wrapSummary(issue.fields.summary, CARD_WIDTH_CHARS, CARD_MAX_SUMMARY_LINES);

    return [
        `🎫 <b>${escapeHtml(issue.key)}</b>`,
        CARD_SEPARATOR,
        escapeHtml(summary),
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
    return `📊 تعداد کل: ${total}  •  📄 صفحه ${page} از ${totalPages}`;
}

/** حداکثر طول توضیحات در صفحه اختصاصی «توضیحات کامل» — امن برای محدودیت ۴۰۹۶ کاراکتری تلگرام */
const DESCRIPTION_FULL_MAX = 3500;

/**
 * صفحه اختصاصی «توضیحات کامل» یک Issue را فرمت می‌کند.
 * برای جلوگیری از شکست ارسال پیام، متن طولانی truncate می‌شود.
 * @param issue - Issue دریافت‌شده از Jira
 */
export function formatIssueDescription(issue: JiraIssue): string {
    const description =
        typeof issue.fields.description === "string" ? stripHtml(issue.fields.description) : "";

    return [
        `📝 توضیحات ${issue.key}`,
        "",
        description ? truncateText(description, DESCRIPTION_FULL_MAX) : "بدون توضیحات.",
    ].join("\n");
}

/** حداکثر طول هر کامنت در صفحه «همه کامنت‌ها» — امن برای محدودیت ۴۰۹۶ کاراکتری تلگرام */
const COMMENT_BODY_MAX = 500;

/**
 * صفحه اختصاصی «همه کامنت‌ها»ی یک Issue را فرمت می‌کند (صفحه‌بندی‌شده).
 * @param issueKey - کلید Issue
 * @param comments - کامنت‌های همین صفحه (جدیدترین اول)
 * @param page - شماره صفحه جاری
 * @param totalPages - تعداد کل صفحات
 * @param total - تعداد کل کامنت‌ها
 */
export function formatIssueComments(
    issueKey: string,
    comments: JiraComment[],
    page: number,
    totalPages: number,
    total: number,
): string {
    if (total === 0) {
        return [`💬 کامنت‌های ${issueKey}`, "", "هیچ کامنتی برای این تسک ثبت نشده است."].join("\n");
    }

    const commentBlocks = comments.map((comment) =>
        [
            `👤 نویسنده: ${comment.author?.displayName ?? "ناشناس"}`,
            `🕐 تاریخ: ${formatRelativeDate(comment.created)}`,
            "",
            truncateText(stripHtml(comment.body), COMMENT_BODY_MAX),
        ].join("\n"),
    );

    return [
        `💬 کامنت‌های ${issueKey}`,
        `📊 تعداد کل: ${total}  •  📄 صفحه ${page} از ${totalPages}`,
        "",
        commentBlocks.join("\n\n────────────\n\n"),
    ].join("\n");
}
