import { JiraClient } from "./jira.client.js";
import type { JiraCredentials } from "../user/user.types.js";

/**
 * Factory برای ساخت JiraClient با اطلاعات کاربر خاص.
 * آدرس پایه Jira یک‌بار از محیط خوانده می‌شود و بین همه کلاینت‌ها مشترک است.
 * هر کاربر JiraClient مجزای خودش را دارد — Credential یک کاربر به دیگری منتقل نمی‌شود.
 */
export class JiraClientFactory {
    private readonly baseURL: string;

    constructor() {
        const baseURL = process.env.JIRA_BASE_URL;
        if (!baseURL) throw new Error("JIRA_BASE_URL is not configured");
        this.baseURL = baseURL;
    }

    /**
     * یک JiraClient جدید برای کاربر مشخص می‌سازد.
     * @param credentials - فقط Token نیاز است؛ username برای احراز هویت Bearer لازم نیست
     * @returns instance مجزای JiraClient برای این کاربر
     */
    createForUser(credentials: Pick<JiraCredentials, "token">): JiraClient {
        return new JiraClient({
            baseURL: this.baseURL,
            token: credentials.token,
        });
    }
}
