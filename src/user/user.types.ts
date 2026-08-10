/**
 * اطلاعات اتصال یک کاربر به حساب Jira.
 * Token به صورت رمزنگاری‌شده در پایگاه داده ذخیره می‌شود
 * و تنها در لایه Repository رمزگشایی می‌گردد.
 */
export interface JiraCredentials {
    /** نام کاربری Jira — از پاسخ /myself.name گرفته می‌شود */
    username: string;
    /** نام نمایشی Jira — از پاسخ /myself.displayName */
    displayName?: string;
    /** شناسه حساب Jira Cloud — در Jira Server معمولاً خالی است */
    accountId?: string;
    /** Personal Access Token برای احراز هویت Bearer */
    token: string;
}

/**
 * مدل کاربر در سیستم.
 * کلید اصلی binding میان Telegram و Jira، همان telegramId است.
 */
export interface User {
    /** شناسه عددی کاربر در Telegram */
    telegramId: number;
    /** اطلاعات اتصال Jira — در صورت عدم اتصال، undefined است */
    jira?: JiraCredentials;
    /** زمان ایجاد رکورد */
    createdAt: Date;
    /** آخرین زمان به‌روزرسانی */
    updatedAt: Date;
}
