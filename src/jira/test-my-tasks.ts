import "dotenv/config";
import { JiraClient } from "./jira.client.js";
import { IssueService } from "./services/issue.service.js";

async function main() {
    const jira = new JiraClient({
        baseURL: process.env.JIRA_BASE_URL ?? "",
        token: process.env.JIRA_PASSWORD ?? "",
    });
    const issueService = new IssueService(jira);

    const result = await issueService.getMyTasks();

    console.log(`Found ${result.total} tasks`);

    for (const task of result.issues) {
        console.log({
            key: task.key,
            summary: task.fields.summary,
            status: task.fields.status?.name,
            priority: task.fields.priority?.name,
        });
    }
}

main().catch((error) => {
    console.error("Failed to fetch tasks");

    if (error instanceof Error) {
        console.error(error.message);
    }

    process.exit(1);
});
