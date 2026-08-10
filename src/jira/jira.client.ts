import axios, { type AxiosInstance } from "axios";

export interface JiraClientCredentials {
    baseURL: string;
    token: string;
}

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

    async getCurrentUser() {
        const response = await this.client.get("/myself");
        return response.data;
    }

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

    async getIssue(issueKey: string) {
        const response = await this.client.get(`/issue/${issueKey}`);
        return response.data;
    }

    async getTransitions(issueKey: string) {
        const response = await this.client.get(`/issue/${issueKey}/transitions`);
        return response.data;
    }

    async transitionIssue(issueKey: string, transitionId: string) {
        await this.client.post(`/issue/${issueKey}/transitions`, {
            transition: { id: transitionId },
        });
    }
}
