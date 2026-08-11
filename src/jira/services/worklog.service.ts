import { JiraClient } from "../jira.client.js";

/**
 * سرویس مدیریت Worklog در Jira.
 * به ازای هر request یک instance ساخته می‌شود.
 */
export class WorklogService {
    constructor(private readonly jira: JiraClient) { }

    /**
     * یک Worklog به Issue اضافه می‌کند.
     * @param issueKey - کلید Issue (مثلاً PROJ-123)
     * @param timeSpent - مدت زمان به فرمت قابل فهم Jira (مثلاً "1h 30m")
     * @param started - زمان شروع به فرمت ISO 8601 با timezone (مثلاً "2026-08-10T13:00:00.000+03:30")
     */
    async addWorklog(issueKey: string, timeSpent: string, started: string): Promise<void> {
        await this.jira.addWorklog(issueKey, { timeSpent, started });
    }
}
