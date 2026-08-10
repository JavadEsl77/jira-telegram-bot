import { InlineKeyboard } from "grammy";

export function connectJiraKeyboard() {
    return new InlineKeyboard()
        .text("🔐 اتصال به Jira", "connect_jira");
}

export function retryConnectJiraKeyboard() {
    return new InlineKeyboard()
        .text("🔄 تلاش مجدد", "connect_jira");
}
