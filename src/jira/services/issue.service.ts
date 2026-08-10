import { JiraClient } from "../jira.client.js";
import type { JiraIssue } from "../jira.types.js";

export interface IssuePage {
    issues: JiraIssue[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export class IssueService {
    constructor(private readonly jira: JiraClient) { }

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

    async getIssue(issueKey: string): Promise<JiraIssue> {
        return this.jira.getIssue(issueKey);
    }
}