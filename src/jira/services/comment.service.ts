import { JiraClient } from "../jira.client.js";

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
}
