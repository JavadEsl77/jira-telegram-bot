export interface JiraCredentials {
    username: string;
    displayName?: string;
    accountId?: string;
    token: string;
}

export interface User {
    telegramId: number;
    jira?: JiraCredentials;
    createdAt: Date;
    updatedAt: Date;
}
