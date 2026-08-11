import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import axios from "axios";

import type { ConversationStateManager } from "../conversation-state.js";
import type { UserService } from "../../user/user.service.js";
import type { JiraClientFactory } from "../../jira/jira.client.factory.js";

import { mainKeyboard } from "../keyboards/main.keyboard.js";
import { retryConnectJiraKeyboard } from "../keyboards/connect-jira.keyboard.js";

/**
 * خطای Jira را به پیام فارسی قابل‌نمایش تبدیل می‌کند.
 * بین خطاهای ۴۰۱/۴۰۳/۴۰۴/5xx و خطای شبکه تمایز قائل می‌شود.
 */
function classifyError(err: unknown): string {
    if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) return "❌ خطای ۴۰۱: Token پذیرفته نشد.";
        if (status === 403) return "❌ خطای ۴۰۳: دسترسی مجاز نیست.";
        if (status === 404) return "❌ خطای ۴۰۴: Jira API endpoint پیدا نشد.";
        if (status && status >= 500) return `❌ خطای ${status}: مشکل در سرور Jira.`;
        if (!err.response) return "❌ خطای شبکه: اتصال به Jira برقرار نشد.";
    }
    return "❌ خطای ناشناخته در اتصال به Jira.";
}

/**
 * Handler جریان اتصال Jira را ثبت می‌کند.
 *
 * دو handler ثبت می‌کند:
 * 1. callback `connect_jira` — وضعیت کاربر را به `waiting_for_jira_token` تغییر می‌دهد
 * 2. `message:text` — PAT را دریافت می‌کند، با `/myself` تأیید می‌کند، و ذخیره می‌کند
 *
 * این handler باید اول از همه ثبت شود تا text interceptor فعال باشد.
 */
export function registerConnectJiraHandler(
    bot: Bot,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
) {
    bot.callbackQuery("connect_jira", async (ctx) => {
        const userId = ctx.from.id;
        await ctx.answerCallbackQuery();

        stateManager.setState(userId, { step: "waiting_for_jira_token" });

        await ctx.editMessageText(
            [
                "لطفاً Personal Access Token حساب Jira خود را ارسال کنید.",
                "",
                "Token را می‌توانید از پروفایل Jira خود → Personal Access Tokens ایجاد کنید.",
            ].join("\n"),
            { reply_markup: new InlineKeyboard() },
        );
    });

    // Must be registered before command handlers to intercept text messages during auth flow
    bot.on("message:text", async (ctx, next) => {
        const userId = ctx.from.id;
        const state = stateManager.getState(userId);

        if (state.step === "idle") {
            return next();
        }

        const text = ctx.message.text;

        // Commands always cancel the current conversation flow
        if (text.startsWith("/")) {
            stateManager.clearState(userId);
            return next();
        }

        if (state.step === "waiting_for_jira_token") {
            const token = text.trim();

            stateManager.clearState(userId);

            await ctx.reply("⏳ در حال بررسی Token...");

            try {
                const jiraClient = jiraClientFactory.createForUser({ token });
                const myself = await jiraClient.getCurrentUser();

                const username =
                    typeof myself.name === "string" ? myself.name : "";
                const displayName =
                    typeof myself.displayName === "string"
                        ? myself.displayName
                        : undefined;

                await userService.connectJira(userId, username, token, displayName);

                await ctx.reply(
                    [
                        "✅ حساب Jira با موفقیت متصل شد.",
                        "",
                        `👤 ${displayName ?? username}`,
                    ].join("\n"),
                    { reply_markup: mainKeyboard() },
                );
            } catch (err) {
                const reason = classifyError(err);

                await ctx.reply(
                    [
                        "❌ اتصال به Jira انجام نشد.",
                        "",
                        reason,
                        "",
                        "مطمئن شوید Token معتبر است و منقضی نشده.",
                    ].join("\n"),
                    { reply_markup: retryConnectJiraKeyboard() },
                );
            }
        }

        if (state.step === "waiting_for_comment") {
            const trimmed = text.trim();

            if (!trimmed) {
                await ctx.reply(
                    "❌ متن کامنت نمی‌تواند خالی باشد.\n\nلطفاً متن کامنت را ارسال کنید.",
                );
                return;
            }

            if (trimmed.length > 5000) {
                await ctx.reply(
                    "❌ متن کامنت بیش از حد طولانی است.\n\nحداکثر 5000 کاراکتر.",
                );
                return;
            }

            const issueKey = state.issueKey ?? "";

            stateManager.setState(userId, {
                step: "waiting_for_comment",
                issueKey,
                commentBody: trimmed,
            });

            const previewKeyboard = new InlineKeyboard()
                .text("✅ ارسال کامنت", `comment-confirm:${issueKey}`)
                .text("❌ لغو", `comment-cancel:${issueKey}`);

            await ctx.reply(
                [
                    "💬 پیش‌نمایش کامنت",
                    "",
                    trimmed,
                    "",
                    "آیا کامنت ارسال شود؟",
                ].join("\n"),
                { reply_markup: previewKeyboard },
            );
        }
    });
}
