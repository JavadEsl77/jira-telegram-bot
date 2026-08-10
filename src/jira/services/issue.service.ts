import { JiraClient } from "../jira.client.js";
import type { JiraIssue } from "../jira.types.js";

/** نتیجه صفحه‌بندی‌شده از Issue‌ها */
export interface IssuePage {
    issues: JiraIssue[];
    /** شماره صفحه جاری (از ۱) */
    page: number;
    /** تعداد آیتم در هر صفحه */
    pageSize: number;
    /** تعداد کل Issue‌ها */
    total: number;
    /** تعداد کل صفحات */
    totalPages: number;
}

/**
 * سرویس مدیریت و دریافت Issue‌های Jira.
 * به ازای هر request یک instance ساخته می‌شود تا Credential کاربران مخلوط نشود.
 */
export class IssueService {
    constructor(private readonly jira: JiraClient) { }

    /**
     * تسک‌های تخصیص‌یافته به کاربر جاری را صفحه‌بندی‌شده برمی‌گرداند.
     * فقط Issue‌های حل‌نشده (resolution = EMPTY) نمایش داده می‌شوند.
     * @param page - شماره صفحه (پیش‌فرض: ۱)
     * @param pageSize - تعداد آیتم در هر صفحه (پیش‌فرض: ۵)
     */
    async getMyTasks(
        page = 1,
        pageSize = 5,
    ): Promise<IssuePage> {
        const startAt = (page - 1) * pageSize;

        const result = await this.jira.searchIssues(
            `
      assignee = currentUser()
      AND resolution = EMPTY
      ORDER BY updated DESC
    `
                .replace(/\s+/g, " ")
                .trim(),
            {
                startAt,
                maxResults: pageSize,
            },
        );

        return {
            issues: result.issues,
            page,
            pageSize,
            total: result.total,
            totalPages: Math.ceil(
                result.total / pageSize,
            ),
        };
    }

    /**
     * جزئیات کامل یک Issue را برمی‌گرداند.
     * @param issueKey - کلید Issue (مثلاً PROJ-123)
     */
    async getIssue(issueKey: string): Promise<JiraIssue> {
        return this.jira.getIssue(issueKey);
    }
}
