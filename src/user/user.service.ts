import type { JiraCredentials, User } from "./user.types.js";
import type { UserRepository } from "./user.repository.js";

/** مقدار پیش‌فرض تعداد تسک در هر صفحه */
export const DEFAULT_TASK_PAGE_SIZE = 5;
/** کمترین تعداد تسک مجاز در هر صفحه */
export const TASK_PAGE_SIZE_MIN = 1;
/** بیشترین تعداد تسک مجاز در هر صفحه */
export const TASK_PAGE_SIZE_MAX = 10;

/**
 * سرویس مدیریت کاربران و binding میان Telegram و Jira.
 * این کلاس منطق تجاری مربوط به کاربران را کپسوله می‌کند
 * و مستقیماً با Repository ارتباط دارد.
 */
export class UserService {
    constructor(private readonly repo: UserRepository) {}

    /**
     * کاربر را با شناسه Telegram پیدا می‌کند.
     * @param telegramId - شناسه کاربر در Telegram
     * @returns کاربر یا undefined اگر ثبت نشده باشد
     */
    async getByTelegramId(telegramId: number): Promise<User | undefined> {
        return this.repo.findByTelegramId(telegramId);
    }

    /**
     * کاربر را پیدا می‌کند یا در صورت عدم وجود، رکورد جدید می‌سازد.
     * @param telegramId - شناسه کاربر در Telegram
     * @returns کاربر موجود یا تازه‌ایجادشده
     */
    async getOrCreate(telegramId: number): Promise<User> {
        const existing = await this.repo.findByTelegramId(telegramId);
        if (existing) return existing;

        const now = new Date();
        const user: User = {
            telegramId,
            taskPageSize: DEFAULT_TASK_PAGE_SIZE,
            createdAt: now,
            updatedAt: now,
        };
        await this.repo.save(user);
        return user;
    }

    /**
     * اطلاعات Jira را به حساب کاربر متصل می‌کند.
     * Token در لایه Repository رمزنگاری می‌شود — این متد Token خام دریافت می‌کند.
     * @param telegramId - شناسه کاربر در Telegram
     * @param username - نام کاربری Jira (از /myself.name)
     * @param token - Personal Access Token خام
     * @param displayName - نام نمایشی (از /myself.displayName)
     */
    async connectJira(
        telegramId: number,
        username: string,
        token: string,
        displayName?: string,
    ): Promise<void> {
        const user = await this.getOrCreate(telegramId);
        await this.repo.save({
            ...user,
            jira: { username, token, displayName },
            updatedAt: new Date(),
        });
    }

    /**
     * اتصال Jira را از حساب کاربر حذف می‌کند.
     * رکورد کاربر در پایگاه داده باقی می‌ماند، فقط اطلاعات Jira پاک می‌شود.
     * @param telegramId - شناسه کاربر در Telegram
     */
    async disconnectJira(telegramId: number): Promise<void> {
        const user = await this.getOrCreate(telegramId);
        await this.repo.save({
            telegramId: user.telegramId,
            taskPageSize: user.taskPageSize,
            createdAt: user.createdAt,
            updatedAt: new Date(),
        });
    }

    /**
     * تعداد تسک نمایش‌داده‌شده در هر صفحه را برای کاربر تنظیم می‌کند.
     * @param telegramId - شناسه کاربر در Telegram
     * @param pageSize - عددی بین {@link TASK_PAGE_SIZE_MIN} و {@link TASK_PAGE_SIZE_MAX}
     */
    async setTaskPageSize(telegramId: number, pageSize: number): Promise<void> {
        const user = await this.getOrCreate(telegramId);
        await this.repo.save({
            ...user,
            taskPageSize: pageSize,
            updatedAt: new Date(),
        });
    }

    /**
     * تعداد تسک در هر صفحه را برای کاربر برمی‌گرداند (پیش‌فرض در صورت نبود رکورد).
     * @param telegramId - شناسه کاربر در Telegram
     */
    async getTaskPageSize(telegramId: number): Promise<number> {
        const user = await this.repo.findByTelegramId(telegramId);
        return user?.taskPageSize ?? DEFAULT_TASK_PAGE_SIZE;
    }

    /**
     * اطلاعات اتصال Jira کاربر را برمی‌گرداند.
     * Token بازگشتی توسط Repository رمزگشایی شده است.
     * @param telegramId - شناسه کاربر در Telegram
     * @returns اطلاعات Jira یا undefined اگر متصل نشده باشد
     */
    async getJiraCredentials(
        telegramId: number,
    ): Promise<JiraCredentials | undefined> {
        const user = await this.repo.findByTelegramId(telegramId);
        return user?.jira;
    }
}
