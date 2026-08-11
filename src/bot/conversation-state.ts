/**
 * مرحله جاری کاربر در جریان مکالمه.
 * - `idle`: کاربر در هیچ جریان فعالی نیست
 * - `waiting_for_jira_token`: منتظر دریافت Personal Access Token است
 * - `waiting_for_comment`: منتظر متن کامنت برای یک Issue است
 */
export type ConversationStep = "idle" | "waiting_for_jira_token" | "waiting_for_comment";

interface ConversationState {
    step: ConversationStep;
    /** کلید Issue در جریان افزودن کامنت */
    issueKey?: string;
    /** متن کامنت که کاربر ارسال کرده (برای پیش‌نمایش) */
    commentBody?: string;
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
