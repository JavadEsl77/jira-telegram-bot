import { JiraClient } from "../jira.client.js";
import type {
    JiraIssue,
    JiraSearchResult,
} from "../jira.types.js";

export interface SearchOptions {
    startAt?: number;
    maxResults?: number;
}

export class SearchService {
    constructor(private readonly jira: JiraClient) { }

    async search(
        jql: string,
        options?: SearchOptions,
    ): Promise<JiraSearchResult> {
        const result = await this.jira.searchIssues(
            jql,
            {
                startAt: options?.startAt ?? 0,
                maxResults: options?.maxResults ?? 20,
            },
        );

        return {
            issues: result.issues as JiraIssue[],
            total: result.total,
            startAt: result.startAt,
            maxResults: result.maxResults,
        };
    }

    async searchText(
        text: string,
        options?: SearchOptions,
    ): Promise<JiraSearchResult> {
        const escapedText = text.replace(/"/g, '\\"');

        const jql = `
    text ~ "${escapedText}"
    ORDER BY updated DESC
  `.replace(/\s+/g, " ").trim();

        return this.search(jql, options);
    }
}