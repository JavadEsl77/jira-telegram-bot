import { JiraClient } from "../jira.client.js";
import type { JiraAssignableUser, JiraIdNameOption } from "../jira.types.js";

/** نتیجه صفحه‌بندی‌شده کاربران قابل Assign (بدون total، چون Jira آن را برنمی‌گرداند) */
export interface AssignableUserPage {
    users: JiraAssignableUser[];
    page: number;
    hasNextPage: boolean;
}

/** ورودی موردنیاز برای ایجاد یک Issue جدید */
export interface CreateIssueInput {
    projectKey: string;
    issueTypeId: string;
    summary: string;
    description?: string;
    priorityId?: string;
    assigneeName?: string;
    /** فرمت pretty-duration جیرا، مثلاً "1h 30m" یا "2d" */
    originalEstimate?: string;
    labels?: string[];
}

/**
 * سرویس ایجاد Issue جدید در Jira — شامل دریافت metadata (Issue Type/Priority/Assignee) و ثبت نهایی.
 * به ازای هر request یک instance ساخته می‌شود تا Credential کاربران مخلوط نشود.
 */
export class CreateIssueService {
    constructor(private readonly jira: JiraClient) { }

    /** لیست کامل Priorityهای تعریف‌شده در Jira را برمی‌گرداند. */
    async getPriorities(): Promise<JiraIdNameOption[]> {
        return this.jira.getPriorities();
    }

    /**
     * کاربران قابل Assign یک پروژه را صفحه‌بندی‌شده برمی‌گرداند.
     * چون Jira تعداد کل را برنمی‌گرداند، با گرفتن یک آیتم اضافه تشخیص می‌دهد صفحه بعدی وجود دارد یا نه.
     * @param projectKey - کلید پروژه
     * @param page - شماره صفحه (پیش‌فرض: ۱)
     * @param pageSize - تعداد آیتم در هر صفحه (پیش‌فرض: ۸)
     */
    async getAssignableUsers(
        projectKey: string,
        page = 1,
        pageSize = 8,
    ): Promise<AssignableUserPage> {
        const startAt = (page - 1) * pageSize;
        const users: JiraAssignableUser[] = await this.jira.getAssignableUsers(projectKey, {
            startAt,
            maxResults: pageSize + 1,
        });

        return {
            users: users.slice(0, pageSize),
            page,
            hasNextPage: users.length > pageSize,
        };
    }

    /**
     * یک Issue جدید ایجاد می‌کند. فقط Fieldهای دارای مقدار در payload ارسال می‌شوند.
     * Creator/Reporter را Jira خودش بر اساس Token احراز هویت‌شده تعیین می‌کند.
     * @param input - اطلاعات Issue جدید
     * @returns Issue ایجادشده (شامل key واقعی)
     */
    async createIssue(input: CreateIssueInput): Promise<{ id: string; key: string }> {
        const fields: Record<string, unknown> = {
            project: { key: input.projectKey },
            summary: input.summary,
            issuetype: { id: input.issueTypeId },
        };

        if (input.description) {
            fields.description = input.description;
        }

        if (input.priorityId) {
            fields.priority = { id: input.priorityId };
        }

        if (input.assigneeName) {
            fields.assignee = { name: input.assigneeName };
        }

        if (input.labels && input.labels.length > 0) {
            fields.labels = input.labels;
        }

        if (input.originalEstimate) {
            fields.timetracking = { originalEstimate: input.originalEstimate };
        }

        return this.jira.createIssue({ fields });
    }
}
