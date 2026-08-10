import "dotenv/config";

import { JiraClient } from "./jira.client.js";
import { SearchService } from "./services/search.service.js";

async function main() {
    const jira = new JiraClient({
        baseURL: process.env.JIRA_BASE_URL ?? "",
        token: process.env.JIRA_PASSWORD ?? "",
    });
    const searchService = new SearchService(jira);

    const result = await searchService.searchText("front");

    console.log(`Total: ${result.total}`);

    for (const issue of result.issues) {
        console.log({
            key: issue.key,
            summary: issue.fields.summary,
            status: issue.fields.status?.name,
            priority: issue.fields.priority?.name,
        });
    }
}

main().catch((error) => {
    console.error("Search failed");

    if (error instanceof Error) {
        console.error(error.message);
    }

    process.exit(1);
});
