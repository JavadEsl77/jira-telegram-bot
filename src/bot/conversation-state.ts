/**
 * مراحل جریان ثبت Worklog.
 */
export type ConversationStep =
    | "idle"
    | "waiting_for_jira_token"
    | "waiting_for_comment"
    | "waiting_for_worklog_duration"
    | "selecting_worklog_date"
    | "selecting_worklog_time"
    | "confirm_worklog"
    | "waiting_for_page_size"
    | "waiting_for_search_query"
    | "create_issue_project"
    | "create_issue_summary"
    | "create_issue_description"
    | "create_issue_priority"
    | "create_issue_assignee"
    | "create_issue_estimate"
    | "create_issue_estimate_custom"
    | "create_issue_labels"
    | "create_issue_preview";

interface ConversationState {
    step: ConversationStep;
    /** کلید Issue در جریان افزودن کامنت */
    issueKey?: string;
    /** متن کامنت که کاربر ارسال کرده (برای پیش‌نمایش) */
    commentBody?: string;

    /** مدت زمان واردشده برای Worklog (مثلاً "1h 30m") */
    worklogDuration?: string;
    /** کل زمان به دقیقه */
    worklogDurationMinutes?: number;
    /** تاریخ انتخاب‌شده به فرمت YYYY-MM-DD (میلادی) */
    worklogSelectedDate?: string;
    /** تاریخ و ساعت شروع به فرمت ISO */
    worklogStartedAt?: string;
    /** ماه جاری تقویم ( Jalali year) */
    worklogCalendarYear?: number;
    /** ماه جاری تقویم (Jalali month) */
    worklogCalendarMonth?: number;
    /** وضعیت در حال ثبت (برای جلوگیری از دوبار کلیک) */
    worklogSubmitting?: boolean;
    /** شناسه تمام پیام‌های لیست جاری: [header, card1, card2, ..., pagination] */
    taskListAllMessageIds?: number[];
    /** شماره صفحه‌ای که کاربر از آن وارد Issue Detail شده — برای بازگشت به همان صفحه */
    fromPage?: number;
    /** عبارت جستجوی جاری — برای Pagination و بازگشت از Issue Detail به نتایج جستجو */
    searchQuery?: string;

    // --- جریان ایجاد تسک (Create Issue) ---
    /** کلید پروژه مقصد — کاربر خودش از لیست پروژه‌های Jira انتخاب می‌کند */
    createIssueProjectKey?: string;
    createIssueProjectName?: string;
    /** شماره صفحه جاری لیست پروژه‌ها */
    createIssueProjectPage?: number;
    /** کش کامل لیست پروژه‌ها (برای Pagination سمت کلاینت بدون fetch مجدد) */
    createIssueProjectOptions?: { id: string; key: string; name: string }[];
    createIssueSummary?: string;
    createIssueDescription?: string;
    createIssuePriorityId?: string;
    createIssuePriorityName?: string;
    /** username کاربر Assign شده (فرمت Jira Server) */
    createIssueAssigneeName?: string;
    createIssueAssigneeDisplayName?: string;
    /** شماره صفحه جاری لیست کاربران قابل Assign */
    createIssueAssigneePage?: number;
    /** فرمت pretty-duration جیرا، مثلاً "1h 30m" یا "2d" */
    createIssueEstimate?: string;
    createIssueLabels?: string[];
    /** true یعنی کاربر از صفحه Preview وارد ویرایش یک فیلد شده — بعد از ثبت باید به Preview برگردد */
    createIssueEditMode?: boolean;
    /** جلوگیری از دوبار کلیک روی «ایجاد تسک» */
    createIssueSubmitting?: boolean;
    /** کش موقت گزینه‌های Priority نمایش‌داده‌شده — برای lookup نام از روی id در انتخاب کاربر */
    createIssueOptionsCache?: { id: string; name: string }[];
    /** کش موقت کاربران قابل Assign نمایش‌داده‌شده — برای lookup displayName از روی username در انتخاب کاربر */
    createIssueAssigneeOptions?: { name: string; displayName: string }[];
}

/**
 * مدیر وضعیت مکالمه — هر کاربر Telegram وضعیت مستقل خودش را دارد.
 * از یک Map درون‌حافظه‌ای استفاده می‌شود؛ داده‌ها پس از restart پاک می‌شوند
 * که برای وضعیت مکالمه کاملاً قابل قبول است.
 */
export class ConversationStateManager {
    private readonly states = new Map<number, ConversationState>();

    /**
     * وضعیت جاری کاربر را برمی‌گرداند.
     * اگر کاربر وضعیتی نداشته باشد، `idle` برگردانده می‌شود.
     * @param userId - شناسه Telegram کاربر
     */
    getState(userId: number): ConversationState {
        return this.states.get(userId) ?? { step: "idle" };
    }

    /**
     * وضعیت کاربر را تنظیم می‌کند.
     * @param userId - شناسه Telegram کاربر
     * @param state - وضعیت جدید
     */
    setState(userId: number, state: ConversationState): void {
        this.states.set(userId, state);
    }

    /**
     * وضعیت کاربر را پاک می‌کند (برگشت به idle).
     * هنگام تکمیل یا لغو جریان مکالمه فراخوانی می‌شود.
     * @param userId - شناسه Telegram کاربر
     */
    clearState(userId: number): void {
        this.states.delete(userId);
    }
}
