import "dotenv/config";
import { JiraClient } from "./jira.client.js";

async function main() {
    const jira = new JiraClient({
        baseURL: process.env.JIRA_BASE_URL ?? "",
        token: process.env.JIRA_PASSWORD ?? "",
    });

    const user = await jira.getCurrentUser();

    console.log(user);
}

main().catch((error) => {
    console.error("Jira connection failed");

    if (error instanceof Error) {
        console.error(error.message);
    }

    process.exit(1);
});
