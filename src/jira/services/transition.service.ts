import { JiraClient } from "../jira.client.js";
import type {
    JiraTransition,
    JiraTransitionOption,
} from "../jira.types.js";

/**
 * سرویس مدیریت transition‌های Jira (تغییر وضعیت Issue).
 * به ازای هر request یک instance ساخته می‌شود.
 */
export class TransitionService {
    constructor(private readonly jira: JiraClient) { }

    /**
     * لیست transition‌های ممکن برای یک Issue را برمی‌گرداند.
     * @param issueKey - کلید Issue (مثلاً PROJ-123)
     * @returns آرایه‌ای از گزینه‌های transition قابل نمایش در Telegram
     */
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

    /**
     * یک transition را با شناسه مستقیم اجرا می‌کند.
     * @param issueKey - کلید Issue
     * @param transitionId - شناسه transition (از getAvailable)
     */
    async transition(
        issueKey: string,
        transitionId: string,
    ): Promise<void> {
        await this.jira.transitionIssue(
            issueKey,
            transitionId,
        );
    }

    /**
     * Issue را به وضعیت مشخص‌شده انتقال می‌دهد (جستجو بر اساس نام وضعیت).
     * @param issueKey - کلید Issue
     * @param targetStatus - نام وضعیت مقصد (case-insensitive)
     * @throws اگر transition به وضعیت مورد نظر وجود نداشته باشد
     */
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
