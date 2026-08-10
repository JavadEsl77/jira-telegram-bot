import "dotenv/config";
import { JiraClient } from "./jira.client.js";
import { TransitionService } from "./services/transition.service.js";

async function main() {
    const jira = new JiraClient({
        baseURL: process.env.JIRA_BASE_URL ?? "",
        token: process.env.JIRA_PASSWORD ?? "",
    });
    const transitionService = new TransitionService(jira);

    const transitions = await transitionService.getAvailable("DATKAN-208");

    console.log(transitions);
}

main().catch((error) => {
    console.error("Failed to get transitions");

    if (error instanceof Error) {
        console.error(error.message);
    }

    process.exit(1);
});
