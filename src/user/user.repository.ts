import type { User } from "./user.types.js";

/**
 * قرارداد ذخیره‌سازی کاربران.
 * پیاده‌سازی‌های مختلف (حافظه، پایگاه داده) این interface را implement می‌کنند
 * تا UserService بدون وابستگی به زیرساخت خاص کار کند.
 */
export interface UserRepository {
    /**
     * کاربر را با شناسه Telegram جستجو می‌کند.
     * @param telegramId - شناسه عددی کاربر در Telegram
     * @returns کاربر پیداشده یا undefined اگر وجود نداشته باشد
     */
    findByTelegramId(telegramId: number): Promise<User | undefined>;

    /**
     * کاربر را ذخیره یا به‌روز می‌کند (upsert).
     * @param user - داده‌های کاربر برای ذخیره‌سازی
     */
    save(user: User): Promise<void>;
}

/**
 * پیاده‌سازی درون‌حافظه‌ای UserRepository.
 * مناسب برای تست‌ها و محیط‌های موقت.
 * داده‌ها پس از restart از بین می‌روند.
 */
export class InMemoryUserRepository implements UserRepository {
    private readonly users = new Map<number, User>();

    async findByTelegramId(telegramId: number): Promise<User | undefined> {
        return this.users.get(telegramId);
    }

    async save(user: User): Promise<void> {
        this.users.set(user.telegramId, user);
    }
}
