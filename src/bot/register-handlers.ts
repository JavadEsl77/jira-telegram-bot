import type { Bot } from "grammy";

import type { UserService } from "../user/user.service.js";
import type { JiraClientFactory } from "../jira/jira.client.factory.js";
import type { ConversationStateManager } from "./conversation-state.js";

import { registerConnectJiraHandler } from "./handlers/connect-jira.handler.js";
import { registerStartHandler } from "./handlers/start.handler.js";
import { registerSettingsHandler } from "./handlers/settings.handler.js";
import { registerMyTasksHandler } from "./handlers/my-tasks.handler.js";
import { registerIssueDetailHandler } from "./handlers/issue-detail.handler.js";
import { registerTransitionHandler } from "./handlers/transition.handler.js";
import { registerCommentHandler } from "./handlers/comment.handler.js";
import { registerWorklogHandler } from "./handlers/worklog.handler.js";

/** وابستگی‌های مشترک بین تمام handler‌ها */
interface HandlerDependencies {
    userService: UserService;
    jiraClientFactory: JiraClientFactory;
    stateManager: ConversationStateManager;
}

/**
 * تمام handler‌های bot را ثبت می‌کند.
 * ترتیب ثبت مهم است — `registerConnectJiraHandler` باید اول باشد
 * چون `bot.on("message:text")` را ثبت می‌کند که پیام‌های متنی را رهگیری می‌کند.
 */
export function registerHandlers(
    bot: Bot,
    dependencies: HandlerDependencies,
) {
    const { userService, jiraClientFactory, stateManager } = dependencies;

    // Conversation state handler must be first — intercepts text messages
    // during Jira authentication flow and calls next() when user is idle
    registerConnectJiraHandler(bot, userService, jiraClientFactory, stateManager);

    registerStartHandler(bot, userService);
    registerSettingsHandler(bot, userService, stateManager);
    registerMyTasksHandler(bot, userService, jiraClientFactory, stateManager);
    registerIssueDetailHandler(bot, userService, jiraClientFactory, stateManager);
    registerTransitionHandler(bot, userService, jiraClientFactory, stateManager);
    registerCommentHandler(bot, userService, jiraClientFactory, stateManager);
    registerWorklogHandler(bot, userService, jiraClientFactory, stateManager);
}
