import { JiraClient } from "../jira.client.js";
import type {
    JiraIssue,
    JiraSearchResult,
} from "../jira.types.js";

/** تنظیمات pagination برای جستجو */
export interface SearchOptions {
    startAt?: number;
    maxResults?: number;
}

/**
 * سرویس جستجوی Issue در Jira با JQL.
 * به ازای هر request یک instance ساخته می‌شود.
 */
export class SearchService {
    constructor(private readonly jira: JiraClient) { }

    /**
     * Issue‌ها را با یک عبارت JQL جستجو می‌کند.
     * @param jql - عبارت JQL کامل
     * @param options - تنظیمات pagination
     */
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

    /**
     * جستجوی متنی آزاد در Issue‌ها.
     * کاراکترهای خاص در متن جستجو escape می‌شوند.
     * @param text - متن جستجو
     * @param options - تنظیمات pagination
     */
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
