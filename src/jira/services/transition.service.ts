import { JiraClient } from "../jira.client.js";
import type {
    JiraTransition,
    JiraTransitionOption,
} from "../jira.types.js";

export class TransitionService {
    constructor(private readonly jira: JiraClient) { }

    async getAvailable(
        issueKey: string,
    ): Promise<JiraTransitionOption[]> {
        const result = await this.jira.getTransitions(issueKey);

        const transitions =
            result.transitions as JiraTransition[];

        return transitions.map((transition) => ({
            id: transition.id,
            name: transition.name,
            targetStatus: transition.to.name,
            targetStatusId: transition.to.id,
        }));
    }

    async transition(
        issueKey: string,
        transitionId: string,
    ): Promise<void> {
        await this.jira.transitionIssue(
            issueKey,
            transitionId,
        );
    }

    async transitionTo(
        issueKey: string,
        targetStatus: string,
    ): Promise<void> {
        const transitions = await this.getAvailable(issueKey);

        const transition = transitions.find(
            (item) =>
                item.targetStatus.toLowerCase() ===
                targetStatus.toLowerCase(),
        );

        if (!transition) {
            const available = transitions
                .map((item) => item.targetStatus)
                .join(", ");

            throw new Error(
                `Cannot transition ${issueKey} to "${targetStatus}". ` +
                `Available statuses: ${available}`,
            );
        }

        await this.transition(
            issueKey,
            transition.id,
        );
    }
}