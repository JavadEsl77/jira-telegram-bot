import { JiraClient } from "./jira.client.js";
import type { JiraCredentials } from "../user/user.types.js";

export class JiraClientFactory {
    private readonly baseURL: string;

    constructor() {
        const baseURL = process.env.JIRA_BASE_URL;
        if (!baseURL) throw new Error("JIRA_BASE_URL is not configured");
        this.baseURL = baseURL;
    }

    createForUser(credentials: Pick<JiraCredentials, "token">): JiraClient {
        return new JiraClient({
            baseURL: this.baseURL,
            token: credentials.token,
        });
    }
}
