import type { User } from "./user.types.js";

export interface UserRepository {
    findByTelegramId(telegramId: number): Promise<User | undefined>;
    save(user: User): Promise<void>;
}

export class InMemoryUserRepository implements UserRepository {
    private readonly users = new Map<number, User>();

    async findByTelegramId(telegramId: number): Promise<User | undefined> {
        return this.users.get(telegramId);
    }

    async save(user: User): Promise<void> {
        this.users.set(user.telegramId, user);
    }
}
