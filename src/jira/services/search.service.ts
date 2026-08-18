import { JiraClient } from "../jira.client.js";
import type {
    JiraIssue,
    JiraSearchResult,
} from "../jira.types.js";
import type { IssuePage } from "./issue.service.js";

/** تنظیمات pagination برای جستجو */
export interface SearchOptions {
    startAt?: number;
    maxResults?: number;
}

/**
 * الگوی یک کلید کامل Issue (مثلاً DATKAN-234 یا "DATKAN 234").
 * گروه ۱: کلید پروژه، گروه ۲: شماره Issue.
 */
const EXACT_ISSUE_KEY_PATTERN = /^([A-Za-z][A-Za-z0-9]{1,9})[\s-]+(\d+)$/;

/** الگوی یک query که فقط از رقم تشکیل شده (مثلاً "259") — شماره Issue بدون پیشوند پروژه */
const NUMERIC_ONLY_PATTERN = /^\d+$/;

/**
 * حداکثر تعداد پروژه‌ای که برای ساخت `key in (...)` استفاده می‌شود.
 * از طولانی‌شدن بیش‌ازحد JQL (و URL درخواست) جلوگیری می‌کند.
 */
const MAX_PROJECTS_FOR_NUMERIC_SEARCH = 100;

/**
 * کاراکترهای خاص JQL (`"` و `\`) را escape می‌کند تا متن کاربر
 * نتواند ساختار JQL را بشکند. سایر کاراکترها (`'`, `:`, `(`, `)`, ...)
 * داخل رشته‌ی quoted معنای خاصی ندارند و نیازی به escape ندارند.
 * @param value - متن خام
 */
function escapeJqlString(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * برای query‌های فقط-عددی (مثل "259")، کلید همه پروژه‌های قابل‌دسترس کاربر را
 * می‌گیرد و `key in ("PROJ1-259", "PROJ2-259", ...)` می‌سازد تا Issue Number
 * بدون پیشوند پروژه هم پیدا شود. اگر گرفتن لیست پروژه‌ها شکست بخورد یا تعداد
 * پروژه‌ها خیلی زیاد باشد، undefined برمی‌گرداند (فراخوان به Summary search برمی‌گردد).
 * @param jira - JiraClient متعلق به کاربر جستجوکننده
 * @param issueNumber - بخش عددی query
 */
async function buildNumericKeyClause(
    jira: JiraClient,
    issueNumber: string,
): Promise<string | undefined> {
    try {
        const projects = await jira.getProjects();

        if (projects.length === 0 || projects.length > MAX_PROJECTS_FOR_NUMERIC_SEARCH) {
            return undefined;
        }

        const keyList = projects
            .map((project) => `"${escapeJqlString(project.key)}-${issueNumber}"`)
            .join(", ");

        return `key in (${keyList})`;
    } catch (err) {
        console.error("Failed to fetch projects for numeric key search", err);
        return undefined;
    }
}

/**
 * از روی متن آزاد کاربر یک عبارت JQL امن می‌سازد.
 *
 * - اگر متن دقیقاً با فرمت یک Issue Key کامل (مثل DATKAN-234) مطابقت داشته باشد،
 *   جستجو با اولویت روی `key` انجام می‌شود.
 * - اگر متن فقط عدد باشد (مثل "259")، علاوه بر Summary، در کلید همه پروژه‌ها
 *   هم به‌دنبال آن شماره Issue می‌گردد (چون JQL جستجوی substring روی `key` ندارد).
 * - در غیر این صورت جستجو روی `summary` انجام می‌شود (case-insensitive،
 *   طبق رفتار پیش‌فرض عملگر `~` در JQL).
 * @param jira - JiraClient متعلق به کاربر جستجوکننده (برای گرفتن لیست پروژه‌ها در حالت عددی)
 * @param query - متن جستجوی کاربر
 */
async function buildSearchJql(jira: JiraClient, query: string): Promise<string> {
    const trimmed = query.trim();
    const exactKeyMatch = EXACT_ISSUE_KEY_PATTERN.exec(trimmed);

    if (exactKeyMatch) {
        const projectKey = exactKeyMatch[1]!.toUpperCase();
        const issueNumber = exactKeyMatch[2];
        const issueKey = escapeJqlString(`${projectKey}-${issueNumber}`);

        return `key = "${issueKey}" ORDER BY updated DESC`;
    }

    const escapedText = escapeJqlString(trimmed);

    if (NUMERIC_ONLY_PATTERN.test(trimmed)) {
        const keyClause = await buildNumericKeyClause(jira, trimmed);

        if (keyClause) {
            return `(${keyClause} OR summary ~ "${escapedText}") ORDER BY updated DESC`;
        }
    }

    return `summary ~ "${escapedText}" ORDER BY updated DESC`;
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
        const jql = await buildSearchJql(this.jira, text);
        return this.search(jql, options);
    }

    /**
     * جستجوی متنی آزاد را به‌صورت صفحه‌بندی‌شده (مشابه IssueService.getMyTasks) برمی‌گرداند.
     * جستجو در Summary انجام می‌شود؛ اگر متن دقیقاً یک Issue Key کامل باشد،
     * اولویت با تطابق دقیق روی همان Issue Key است.
     * @param query - متن جستجوی کاربر
     * @param page - شماره صفحه (پیش‌فرض: ۱)
     * @param pageSize - تعداد آیتم در هر صفحه (پیش‌فرض: ۵)
     */
    async searchTasks(
        query: string,
        page = 1,
        pageSize = 5,
    ): Promise<IssuePage> {
        const startAt = (page - 1) * pageSize;
        const jql = await buildSearchJql(this.jira, query);
        const result = await this.jira.searchIssues(jql, {
            startAt,
            maxResults: pageSize,
        });

        return {
            issues: result.issues,
            page,
            pageSize,
            total: result.total,
            totalPages: Math.ceil(result.total / pageSize),
        };
    }
}
