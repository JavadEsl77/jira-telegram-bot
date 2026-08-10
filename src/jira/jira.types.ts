export interface JiraTransition {
    id: string;
    name: string;
    description?: string;
    to: {
        id: string;
        name: string;
        description?: string;
        statusCategory?: {
            id: number;
            key: string;
            name: string;
        };
    };
}

export interface JiraTransitionOption {
    id: string;
    name: string;
    targetStatus: string;
    targetStatusId: string;
}

export interface JiraIssue {
    id: string;
    key: string;

    fields: {
        summary: string;

        status?: {
            id: string;
            name: string;
        };

        priority?: {
            id: string;
            name: string;
        };

        assignee?: {
            accountId?: string;
            name?: string;
            displayName: string;
        };

        reporter?: {
            accountId?: string;
            name?: string;
            displayName: string;
        };

        issuetype?: {
            id: string;
            name: string;
        };

        labels?: string[];

        duedate?: string | null;

        components?: {
            id: string;
            name: string;
        }[];

        project?: {
            id: string;
            key: string;
            name: string;
        };

        updated?: string;
        created?: string;

        description?: unknown;
    };
}

export interface JiraSearchResult {
    issues: JiraIssue[];
    total: number;
    startAt: number;
    maxResults: number;
}