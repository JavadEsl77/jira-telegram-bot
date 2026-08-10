export type ConversationStep = "idle" | "waiting_for_jira_token";

interface ConversationState {
    step: ConversationStep;
}

export class ConversationStateManager {
    private readonly states = new Map<number, ConversationState>();

    getState(userId: number): ConversationState {
        return this.states.get(userId) ?? { step: "idle" };
    }

    setState(userId: number, state: ConversationState): void {
        this.states.set(userId, state);
    }

    clearState(userId: number): void {
        this.states.delete(userId);
    }
}
