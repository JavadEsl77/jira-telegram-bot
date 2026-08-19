import axios, { type AxiosInstance } from "axios";

/** اطلاعات مورد نیاز برای ساخت یک JiraClient */
export interface JiraClientCredentials {
    /** آدرس پایه Jira (بدون /rest/api/...) */
    baseURL: string;
    /** Personal Access Token برای احراز هویت Bearer */
    token: string;
}

/**
 * کلاینت HTTP برای ارتباط با Jira REST API v2.
 *
 * احراز هویت: Bearer Token (مناسب برای Jira Server/Data Center PAT).
 * هر instance به یک کاربر خاص تعلق دارد — از JiraClientFactory برای ساخت استفاده کنید.
 *
 * @see https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html
 */
export class JiraClient {
    private readonly client: AxiosInstance;

    constructor(credentials: JiraClientCredentials) {
        this.client = axios.create({
            baseURL: `${credentials.baseURL}/rest/api/2`,
            timeout: 30_000,
            headers: {
                // Jira Server/Data Center PATs use Bearer token auth, not Basic Auth
                Authorization: `Bearer ${credentials.token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });
    }

    /**
     * اطلاعات کاربر جاری را از Jira می‌گیرد.
     * برای اعتبارسنجی Token هنگام اتصال اولیه استفاده می‌شود.
     * @returns پروفایل کاربر (name, displayName, emailAddress, ...)
     */
    async getCurrentUser() {
        const response = await this.client.get("/myself");
        return response.data;
    }

    /**
     * لیست پروژه‌هایی که کاربر جاری به آن‌ها دسترسی دارد را برمی‌گرداند.
     * برای جستجوی Issue Key‌های عددی (بدون پیشوند پروژه) در همه پروژه‌ها استفاده می‌شود.
     */
    async getProjects(): Promise<{ id: string; key: string; name: string }[]> {
        const response = await this.client.get("/project");
        return response.data;
    }

    /** لیست کامل Priorityهای تعریف‌شده در Jira را برمی‌گرداند. */
    async getPriorities() {
        const response = await this.client.get("/priority");
        return response.data;
    }

    /**
     * مجوزهای کاربر جاری را برمی‌گرداند.
     * بدون `issueKey`/`projectKey`، Jira مجوزهای سطح Project/Issue را «در صورت داشتن در حداقل
     * یک پروژه» گزارش می‌کند — این برای مجوزهای مشروط (مثل «فقط Reporter می‌تواند حذف کند»)
     * می‌تواند نادرست باشد. برای نتیجه دقیق، `issueKey` همان Issue موردنظر را بدهید.
     * @param permissionKeys - کلیدهای مجوز موردنظر (مثلاً `["DELETE_ISSUE"]`)؛ در صورت خالی بودن همه مجوزها برمی‌گردند
     * @param context - محدودکردن بررسی به یک Issue یا Project خاص برای نتیجه دقیق
     */
    async getMyPermissions(
        permissionKeys?: string[],
        context?: { issueKey?: string; projectKey?: string },
    ): Promise<Record<string, { havePermission: boolean }>> {
        const response = await this.client.get("/mypermissions", {
            params: {
                ...(permissionKeys?.length ? { permissions: permissionKeys.join(",") } : {}),
                ...(context?.issueKey ? { issueKey: context.issueKey } : {}),
                ...(context?.projectKey ? { projectKey: context.projectKey } : {}),
            },
        });
        return response.data.permissions ?? {};
    }

    /**
     * کاربران قابل Assign به یک پروژه را برمی‌گرداند (بدون اطلاعات pagination از سمت Jira).
     * @param projectKey - کلید پروژه
     * @param options - تنظیمات pagination
     */
    async getAssignableUsers(
        projectKey: string,
        options?: {
            startAt?: number;
            maxResults?: number;
        },
    ) {
        const response = await this.client.get("/user/assignable/search", {
            params: {
                project: projectKey,
                startAt: options?.startAt ?? 0,
                maxResults: options?.maxResults ?? 20,
            },
        });
        return response.data;
    }

    /**
     * یک Issue جدید در Jira ایجاد می‌کند.
     * @param payload - آبجکت `{ fields }` طبق فرمت Jira REST API v2
     * @returns آبجکت شامل `key` واقعی Issue ایجادشده
     */
    async createIssue(payload: { fields: Record<string, unknown> }): Promise<{ id: string; key: string }> {
        const response = await this.client.post("/issue", payload);
        return response.data;
    }

    /**
     * Issue‌ها را با یک JQL query جستجو می‌کند.
     * @param jql - عبارت JQL (Jira Query Language)
     * @param options - تنظیمات pagination
     */
    async searchIssues(
        jql: string,
        options?: {
            startAt?: number;
            maxResults?: number;
        },
    ) {
        const response = await this.client.get("/search", {
            params: {
                jql,
                startAt: options?.startAt ?? 0,
                maxResults: options?.maxResults ?? 20,
            },
        });
        return response.data;
    }

    /**
     * جزئیات کامل یک Issue را برمی‌گرداند.
     * @param issueKey - کلید Issue (مثلاً PROJ-123)
     */
    async getIssue(issueKey: string) {
        const response = await this.client.get(`/issue/${issueKey}`);
        return response.data;
    }

    /**
     * لیست transition‌های ممکن برای یک Issue را برمی‌گرداند.
     * @param issueKey - کلید Issue
     */
    async getTransitions(issueKey: string) {
        const response = await this.client.get(`/issue/${issueKey}/transitions`);
        return response.data;
    }

    /**
     * یک transition را روی Issue اعمال می‌کند (تغییر وضعیت).
     * @param issueKey - کلید Issue
     * @param transitionId - شناسه transition (از getTransitions)
     */
    async transitionIssue(issueKey: string, transitionId: string) {
        await this.client.post(`/issue/${issueKey}/transitions`, {
            transition: { id: transitionId },
        });
    }

    /**
     * یک کامنت را به Issue اضافه می‌کند.
     * @param issueKey - کلید Issue (مثلاً PROJ-123)
     * @param body - متن کامنت
     */
    async addComment(issueKey: string, body: string) {
        await this.client.post(`/issue/${issueKey}/comment`, {
            body,
        });
    }

    /**
     * کامنت‌های یک Issue را صفحه‌بندی‌شده و به‌ترتیب جدیدترین اول برمی‌گرداند.
     * برخلاف `comment` embedded در پاسخ GET issue، این endpoint pagination واقعی دارد.
     * @param issueKey - کلید Issue (مثلاً PROJ-123)
     * @param options - تنظیمات pagination
     */
    async getComments(
        issueKey: string,
        options?: {
            startAt?: number;
            maxResults?: number;
        },
    ) {
        const response = await this.client.get(`/issue/${issueKey}/comment`, {
            params: {
                startAt: options?.startAt ?? 0,
                maxResults: options?.maxResults ?? 20,
                orderBy: "-created",
            },
        });
        return response.data;
    }

    /**
     * یک Worklog به Issue اضافه می‌کند.
     * @param issueKey - کلید Issue (مثلاً PROJ-123)
     * @param data - اطلاعات Worklog
     */
    async addWorklog(issueKey: string, data: {
        timeSpent: string;
        started: string;
    }) {
        await this.client.post(`/issue/${issueKey}/worklog`, data);
    }

    /**
     * یک Issue را حذف می‌کند. اگر Issue دارای Sub-task باشد، آن‌ها هم حذف می‌شوند
     * (`deleteSubtasks=true`) تا حذف Task‌های دارای Sub-task با خطا مواجه نشود.
     * @param issueKey - کلید Issue (مثلاً PROJ-123)
     */
    async deleteIssue(issueKey: string): Promise<void> {
        await this.client.delete(`/issue/${issueKey}`, {
            params: { deleteSubtasks: true },
        });
    }
}
