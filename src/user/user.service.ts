import type { JiraCredentials, User } from "./user.types.js";
import type { UserRepository } from "./user.repository.js";

export class UserService {
    constructor(private readonly repo: UserRepository) {}

    async getByTelegramId(telegramId: number): Promise<User | undefined> {
        return this.repo.findByTelegramId(telegramId);
    }

    async getOrCreate(telegramId: number): Promise<User> {
        const existing = await this.repo.findByTelegramId(telegramId);
        if (existing) return existing;

        const now = new Date();
        const user: User = { telegramId, createdAt: now, updatedAt: now };
        await this.repo.save(user);
        return user;
    }

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

    async disconnectJira(telegramId: number): Promise<void> {
        const user = await this.getOrCreate(telegramId);
        await this.repo.save({
            telegramId: user.telegramId,
            createdAt: user.createdAt,
            updatedAt: new Date(),
        });
    }

    async getJiraCredentials(
        telegramId: number,
    ): Promise<JiraCredentials | undefined> {
        const user = await this.repo.findByTelegramId(telegramId);
        return user?.jira;
    }
}
