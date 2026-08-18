/** نمایانگر یک transition در Jira — انتقال بین وضعیت‌ها */
export interface JiraTransition {
    /** شناسه یکتای transition */
    id: string;
    /** نام transition (مثلاً "Start Progress") */
    name: string;
    description?: string;
    /** وضعیت مقصد این transition */
    to: {
        id: string;
        name: string;
        description?: string;
        statusCategory?: {
            id: number;
            /** کلید دسته‌بندی وضعیت (مثلاً "indeterminate", "done") */
            key: string;
            name: string;
        };
    };
}

/** نسخه ساده‌شده JiraTransition برای نمایش در Telegram */
export interface JiraTransitionOption {
    id: string;
    /** نام transition */
    name: string;
    /** نام وضعیت مقصد */
    targetStatus: string;
    /** شناسه وضعیت مقصد */
    targetStatusId: string;
}

/** مدل کامل یک Issue در Jira */
export interface JiraIssue {
    /** شناسه داخلی Jira */
    id: string;
    /** کلید قابل نمایش (مثلاً PROJ-123) */
    key: string;

    fields: {
        /** عنوان Issue */
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
            /** نام کاربری (Jira Server) */
            name?: string;
            displayName: string;
        };

        reporter?: {
            accountId?: string;
            name?: string;
            displayName: string;
        };

        creator?: {
            accountId?: string;
            name?: string;
            displayName: string;
        };

        issuetype?: {
            id: string;
            name: string;
        };

        labels?: string[];

        /** تاریخ سررسید به فرمت ISO */
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

        /** آخرین زمان به‌روزرسانی (ISO string) */
        updated?: string;
        /** زمان ایجاد (ISO string) */
        created?: string;

        /** توضیحات Issue — در Jira Server معمولاً متن ساده (wiki markup) است */
        description?: string | null;

        /** چند کامنت آخر Issue — به‌صورت پیش‌فرض همراه پاسخ GET issue برمی‌گردد (بدون pagination کامل) */
        comment?: {
            comments: JiraComment[];
            total: number;
        };
    };
}

/** یک کامنت روی Issue */
export interface JiraComment {
    id: string;
    author?: {
        name?: string;
        displayName: string;
    };
    /** متن کامنت — در Jira Server معمولاً متن ساده (wiki markup) است */
    body: string;
    /** زمان ثبت کامنت (ISO string) */
    created: string;
    /** آخرین زمان ویرایش کامنت (ISO string) */
    updated?: string;
}

/** نتیجه جستجوی Issue در Jira */
export interface JiraSearchResult {
    issues: JiraIssue[];
    /** تعداد کل نتایج */
    total: number;
    /** شماره شروع (برای pagination) */
    startAt: number;
    /** حداکثر نتایج در این صفحه */
    maxResults: number;
}
