import { JiraClient } from "../jira.client.js";
import type { JiraComment } from "../jira.types.js";

/** نتیجه صفحه‌بندی‌شده از کامنت‌های یک Issue */
export interface CommentPage {
    comments: JiraComment[];
    /** شماره صفحه جاری (از ۱) */
    page: number;
    /** تعداد آیتم در هر صفحه */
    pageSize: number;
    /** تعداد کل کامنت‌ها */
    total: number;
    /** تعداد کل صفحات */
    totalPages: number;
}

/**
 * سرویس مدیریت کامنت‌های Jira.
 * به ازای هر request یک instance ساخته می‌شود.
 */
export class CommentService {
    constructor(private readonly jira: JiraClient) { }

    /**
     * یک کامنت را به Issue اضافه می‌کند.
     * @param issueKey - کلید Issue (مثلاً PROJ-123)
     * @param body - متن کامنت
     */
    async addComment(issueKey: string, body: string): Promise<void> {
        await this.jira.addComment(issueKey, body);
    }

    /**
     * کامنت‌های یک Issue را صفحه‌بندی‌شده (جدیدترین اول) برمی‌گرداند.
     * @param issueKey - کلید Issue (مثلاً PROJ-123)
     * @param page - شماره صفحه (پیش‌فرض: ۱)
     * @param pageSize - تعداد آیتم در هر صفحه (پیش‌فرض: ۵)
     */
    async getComments(
        issueKey: string,
        page = 1,
        pageSize = 5,
    ): Promise<CommentPage> {
        const startAt = (page - 1) * pageSize;
        const result = await this.jira.getComments(issueKey, {
            startAt,
            maxResults: pageSize,
        });

        return {
            comments: result.comments,
            page,
            pageSize,
            total: result.total,
            totalPages: Math.ceil(result.total / pageSize),
        };
    }
}
