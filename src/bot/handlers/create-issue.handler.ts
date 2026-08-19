import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import axios from "axios";

import { CreateIssueService } from "../../jira/services/create-issue.service.js";
import type { UserService } from "../../user/user.service.js";
import type { JiraClientFactory } from "../../jira/jira.client.factory.js";
import type { ConversationStateManager } from "../conversation-state.js";

import { getPriorityEmoji } from "../formatters/issue.formatter.js";
import {
    formatCreateIssuePreview,
    formatCreateIssueSuccess,
    type CreateIssueDraft,
} from "../formatters/create-issue.formatter.js";
import {
    cancelOnlyKeyboard,
    descriptionKeyboard,
    editMenuKeyboard,
    estimateKeyboard,
    labelsKeyboard,
    previewKeyboard,
    priorityKeyboard,
    projectKeyboard,
    assigneeKeyboard,
} from "../keyboards/create-issue.keyboard.js";
import { mainKeyboard } from "../keyboards/main.keyboard.js";
import { parseEstimate } from "../utils/duration-parser.js";

/** حداکثر طول مجاز عنوان و توضیحات — جلوگیری از پیام‌های نامعقول‌بزرگ */
const SUMMARY_MAX_LENGTH = 255;
const DESCRIPTION_MAX_LENGTH = 5000;
/** تعداد پروژه در هر صفحه لیست انتخاب پروژه (Pagination سمت کلاینت) */
const PROJECT_PAGE_SIZE = 8;
/** Issue Type ثابت برای تمام تسک‌های ایجادشده از ربات — انتخاب Issue Type از Flow حذف شده است */
const DEFAULT_ISSUE_TYPE_ID = "10002";
const DEFAULT_ISSUE_TYPE_NAME = "Task";

/**
 * پیام را روی همان پیام کلیک‌شده Edit می‌کند (مسیر Callback) یا پیام جدید ارسال می‌کند (مسیر متنی).
 */
async function sendOrEdit(
    ctx: Context,
    text: string,
    opts?: { reply_markup?: InlineKeyboard },
) {
    if (ctx.callbackQuery) {
        await ctx.editMessageText(text, opts);
    } else {
        await ctx.reply(text, opts);
    }
}

/**
 * یک پیام Loading نشان می‌دهد (Edit یا پیام جدید بسته به نوع ورودی)، سپس `work` را با
 * chatId/messageId همان پیام صدا می‌زند تا نتیجه نهایی جایگزین Loading شود.
 */
async function deliver(
    ctx: Context,
    loadingText: string,
    work: (chatId: number, messageId: number) => Promise<void>,
) {
    await ctx.replyWithChatAction("typing");

    if (ctx.callbackQuery) {
        await ctx.editMessageText(loadingText);
        await work(ctx.chat!.id, ctx.msg!.message_id);
    } else {
        const sent = await ctx.reply(loadingText);
        await work(ctx.chat!.id, sent.message_id);
    }
}

function buildDraft(state: ReturnType<ConversationStateManager["getState"]>): CreateIssueDraft {
    return {
        typeName: DEFAULT_ISSUE_TYPE_NAME,
        summary: state.createIssueSummary,
        description: state.createIssueDescription,
        priorityName: state.createIssuePriorityName,
        assigneeDisplayName: state.createIssueAssigneeDisplayName,
        estimate: state.createIssueEstimate,
        labels: state.createIssueLabels,
    };
}

/** بعد از ثبت مقدار یک فیلد: اگر از Preview وارد ویرایش شده بودیم به Preview برمی‌گردیم، وگرنه ادامه Flow خطی. */
async function afterFieldCaptured(
    ctx: Context,
    userId: number,
    userService: UserService,
    stateManager: ConversationStateManager,
    nextStep: () => Promise<void>,
) {
    const state = stateManager.getState(userId);

    if (state.createIssueEditMode) {
        stateManager.setState(userId, { ...state, createIssueEditMode: false });
        await showPreview(ctx, userId, userService, stateManager);
        return;
    }

    await nextStep();
}

async function showPreview(
    ctx: Context,
    userId: number,
    userService: UserService,
    stateManager: ConversationStateManager,
) {
    const state = stateManager.getState(userId);
    const credentials = await userService.getJiraCredentials(userId);
    const creatorDisplayName = credentials?.displayName ?? credentials?.username ?? "ناشناس";

    stateManager.setState(userId, { ...state, step: "create_issue_preview" });

    await sendOrEdit(ctx, formatCreateIssuePreview(buildDraft(state), creatorDisplayName), {
        reply_markup: previewKeyboard(),
    });
}

async function promptLabels(ctx: Context, userId: number, stateManager: ConversationStateManager) {
    stateManager.setState(userId, { ...stateManager.getState(userId), step: "create_issue_labels" });

    await sendOrEdit(
        ctx,
        ["🏷 Labelها را با کاما جدا کنید (اختیاری).", "", "مثال: Front_End, Jira_Bot"].join("\n"),
        { reply_markup: labelsKeyboard() },
    );
}

async function promptEstimate(ctx: Context, userId: number, stateManager: ConversationStateManager) {
    stateManager.setState(userId, { ...stateManager.getState(userId), step: "create_issue_estimate" });

    await sendOrEdit(ctx, "⏱ زمان تخمینی انجام تسک را انتخاب کنید:", {
        reply_markup: estimateKeyboard(),
    });
}

async function promptAssignee(
    ctx: Context,
    userId: number,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
    page: number,
) {
    const state = stateManager.getState(userId);
    const projectKey = state.createIssueProjectKey;
    const credentials = await userService.getJiraCredentials(userId);

    if (!projectKey || !credentials) {
        await sendOrEdit(ctx, "❌ ابتدا حساب Jira خود را متصل کنید.");
        return;
    }

    await deliver(ctx, "⏳ در حال دریافت لیست کاربران...", async (chatId, messageId) => {
        try {
            const jiraClient = jiraClientFactory.createForUser(credentials);
            const service = new CreateIssueService(jiraClient);
            const result = await service.getAssignableUsers(projectKey, page);

            stateManager.setState(userId, {
                ...stateManager.getState(userId),
                step: "create_issue_assignee",
                createIssueAssigneePage: page,
                createIssueAssigneeOptions: result.users,
            });

            await ctx.api.editMessageText(
                chatId,
                messageId,
                "👤 مسئول تسک را انتخاب کنید:",
                { reply_markup: assigneeKeyboard(result.users, page, result.hasNextPage) },
            );
        } catch (error) {
            console.error(
                "Failed to fetch assignable users",
                axios.isAxiosError(error) ? { status: error.response?.status, data: error.response?.data } : error,
            );

            stateManager.setState(userId, {
                ...stateManager.getState(userId),
                step: "create_issue_assignee",
                createIssueAssigneeOptions: [],
            });

            await ctx.api.editMessageText(
                chatId,
                messageId,
                ["⚠️ دریافت لیست کاربران با خطا مواجه شد.", "", "👤 مسئول تسک را انتخاب کنید:"].join("\n"),
                { reply_markup: assigneeKeyboard([], 1, false) },
            );
        }
    });
}

async function promptPriority(
    ctx: Context,
    userId: number,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
) {
    const credentials = await userService.getJiraCredentials(userId);

    if (!credentials) {
        await sendOrEdit(ctx, "❌ ابتدا حساب Jira خود را متصل کنید.");
        return;
    }

    await deliver(ctx, "⏳ در حال دریافت اولویت‌ها...", async (chatId, messageId) => {
        try {
            const jiraClient = jiraClientFactory.createForUser(credentials);
            const service = new CreateIssueService(jiraClient);
            const priorities = await service.getPriorities();

            if (priorities.length === 0) {
                await ctx.api.editMessageText(chatId, messageId, "❌ هیچ اولویتی در Jira پیدا نشد.");
                return;
            }

            stateManager.setState(userId, {
                ...stateManager.getState(userId),
                step: "create_issue_priority",
                createIssueOptionsCache: priorities,
            });

            await ctx.api.editMessageText(chatId, messageId, "⚡ اولویت تسک را انتخاب کنید:", {
                reply_markup: priorityKeyboard(priorities, getPriorityEmoji),
            });
        } catch (error) {
            console.error(
                "Failed to fetch priorities",
                axios.isAxiosError(error) ? { status: error.response?.status, data: error.response?.data } : error,
            );
            await ctx.api.editMessageText(chatId, messageId, "❌ دریافت اولویت‌ها با خطا مواجه شد.");
        }
    });
}

async function promptDescription(ctx: Context, userId: number, stateManager: ConversationStateManager) {
    stateManager.setState(userId, { ...stateManager.getState(userId), step: "create_issue_description" });

    await sendOrEdit(ctx, "📄 توضیحات تسک را وارد کنید.", { reply_markup: descriptionKeyboard() });
}

async function promptSummary(ctx: Context, userId: number, stateManager: ConversationStateManager) {
    stateManager.setState(userId, { ...stateManager.getState(userId), step: "create_issue_summary" });

    await sendOrEdit(ctx, "📝 عنوان تسک را وارد کنید:", { reply_markup: cancelOnlyKeyboard() });
}

/** خروجی متن+کیبورد یک صفحه از لیست پروژه‌ها (Pagination سمت کلاینت، بدون fetch مجدد) */
function renderProjectSelection(
    projects: { key: string; name: string }[],
    page: number,
): { text: string; keyboard: ReturnType<typeof projectKeyboard> } {
    const totalPages = Math.ceil(projects.length / PROJECT_PAGE_SIZE);
    const pageItems = projects.slice((page - 1) * PROJECT_PAGE_SIZE, page * PROJECT_PAGE_SIZE);

    return {
        text: "📁 پروژه را انتخاب کنید:",
        keyboard: projectKeyboard(pageItems, page, totalPages),
    };
}

async function promptProject(
    ctx: Context,
    userId: number,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
    page: number,
) {
    const state = stateManager.getState(userId);
    const cached = state.createIssueProjectOptions;

    if (cached && cached.length > 0) {
        stateManager.setState(userId, { ...state, step: "create_issue_project", createIssueProjectPage: page });
        const { text, keyboard } = renderProjectSelection(cached, page);
        await sendOrEdit(ctx, text, { reply_markup: keyboard });
        return;
    }

    const credentials = await userService.getJiraCredentials(userId);

    if (!credentials) {
        await sendOrEdit(ctx, "❌ ابتدا حساب Jira خود را متصل کنید.");
        return;
    }

    await deliver(ctx, "⏳ در حال دریافت پروژه‌ها...", async (chatId, messageId) => {
        try {
            const jiraClient = jiraClientFactory.createForUser(credentials);
            const projects = await jiraClient.getProjects();

            if (projects.length === 0) {
                await ctx.api.editMessageText(chatId, messageId, "❌ هیچ پروژه‌ای پیدا نشد.");
                return;
            }

            stateManager.setState(userId, {
                ...stateManager.getState(userId),
                step: "create_issue_project",
                createIssueProjectOptions: projects,
                createIssueProjectPage: page,
            });

            const { text, keyboard } = renderProjectSelection(projects, page);
            await ctx.api.editMessageText(chatId, messageId, text, { reply_markup: keyboard });
        } catch (error) {
            console.error(
                "Failed to fetch projects",
                axios.isAxiosError(error) ? { status: error.response?.status, data: error.response?.data } : error,
            );
            await ctx.api.editMessageText(chatId, messageId, "❌ دریافت لیست پروژه‌ها با خطا مواجه شد.");
        }
    });
}

function classifyCreateError(err: unknown): string {
    if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const data = err.response?.data as
            | { errorMessages?: string[]; errors?: Record<string, string> }
            | undefined;

        const details: string[] = [
            ...(data?.errorMessages ?? []),
            ...Object.entries(data?.errors ?? {}).map(([field, msg]) => `${field}: ${msg}`),
        ];

        if (status === 401) return "❌ اتصال Jira شما معتبر نیست.\n\nلطفاً دوباره حساب Jira را متصل کنید.";
        if (status === 403) return "❌ شما اجازه ایجاد تسک در این پروژه را ندارید.";
        if (status === 400 && details.length > 0) {
            return ["❌ ایجاد تسک انجام نشد.", "", ...details].join("\n");
        }
        if (status && status >= 500) return "❌ Jira در حال حاضر پاسخ نمی‌دهد.\n\nلطفاً دوباره تلاش کنید.";
        if (!err.response) return "❌ Jira در حال حاضر پاسخ نمی‌دهد.\n\nلطفاً دوباره تلاش کنید.";
    }
    return "❌ ایجاد تسک انجام نشد.\n\nلطفاً دوباره تلاش کنید.";
}

function cancelCreateIssue(userId: number, stateManager: ConversationStateManager) {
    stateManager.clearState(userId);
}

// --- Text-step handlers — از connect-jira.handler.ts (مرکز رهگیری پیام‌های متنی) فراخوانی می‌شوند ---

export async function handleCreateIssueSummaryText(
    ctx: Context,
    userId: number,
    text: string,
    userService: UserService,
    stateManager: ConversationStateManager,
) {
    const trimmed = text.trim();

    if (!trimmed) {
        await ctx.reply("❌ عنوان تسک نمی‌تواند خالی باشد.");
        return;
    }

    if (trimmed.length > SUMMARY_MAX_LENGTH) {
        await ctx.reply(`❌ عنوان تسک بیش از حد طولانی است.\n\nحداکثر ${SUMMARY_MAX_LENGTH} کاراکتر.`);
        return;
    }

    const state = stateManager.getState(userId);
    stateManager.setState(userId, { ...state, createIssueSummary: trimmed });

    await afterFieldCaptured(ctx, userId, userService, stateManager, () =>
        promptDescription(ctx, userId, stateManager),
    );
}

export async function handleCreateIssueDescriptionText(
    ctx: Context,
    userId: number,
    text: string,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
) {
    const trimmed = text.trim();

    if (trimmed.length > DESCRIPTION_MAX_LENGTH) {
        await ctx.reply(`❌ توضیحات بیش از حد طولانی است.\n\nحداکثر ${DESCRIPTION_MAX_LENGTH} کاراکتر.`);
        return;
    }

    const state = stateManager.getState(userId);
    stateManager.setState(userId, { ...state, createIssueDescription: trimmed || undefined });

    await afterFieldCaptured(ctx, userId, userService, stateManager, () =>
        promptPriority(ctx, userId, userService, jiraClientFactory, stateManager),
    );
}

export async function handleCreateIssueEstimateCustomText(
    ctx: Context,
    userId: number,
    text: string,
    userService: UserService,
    stateManager: ConversationStateManager,
) {
    const parsed = parseEstimate(text);

    if (!parsed) {
        await ctx.reply(
            ["❌ فرمت زمان صحیح نیست.", "", "مثال:", "1h 30m", "3h", "2d"].join("\n"),
        );
        return;
    }

    const state = stateManager.getState(userId);
    stateManager.setState(userId, { ...state, createIssueEstimate: parsed });

    await afterFieldCaptured(ctx, userId, userService, stateManager, () =>
        promptLabels(ctx, userId, stateManager),
    );
}

export async function handleCreateIssueLabelsText(
    ctx: Context,
    userId: number,
    text: string,
    userService: UserService,
    stateManager: ConversationStateManager,
) {
    const labels = text
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean);

    const state = stateManager.getState(userId);
    stateManager.setState(userId, { ...state, createIssueLabels: labels.length > 0 ? labels : undefined });

    await afterFieldCaptured(ctx, userId, userService, stateManager, () =>
        showPreview(ctx, userId, userService, stateManager),
    );
}

/**
 * Handler جریان ایجاد تسک جدید را ثبت می‌کند.
 * جریان ۹ مرحله‌ای: Project → Summary → Description → Priority → Assignee →
 * Estimate → Labels → Preview → Confirm/Edit/Cancel.
 * Issue Type همیشه به‌صورت ثابت Task (`DEFAULT_ISSUE_TYPE_ID`) است — هیچ انتخابی از کاربر گرفته نمی‌شود.
 * مراحل متنی (Summary/Description/Estimate دلخواه/Labels) در `connect-jira.handler.ts`
 * (تنها text interceptor مرکزی پروژه) با فراخوانی توابع export‌شده این فایل پردازش می‌شوند.
 */
export function registerCreateIssueHandler(
    bot: Bot,
    userService: UserService,
    jiraClientFactory: JiraClientFactory,
    stateManager: ConversationStateManager,
) {
    bot.callbackQuery("create_issue", async (ctx) => {
        const userId = ctx.from.id;
        await ctx.answerCallbackQuery();

        stateManager.clearState(userId);
        await promptProject(ctx, userId, userService, jiraClientFactory, stateManager, 1);
    });

    bot.callbackQuery(/^ci-project-page:(\d+)$/, async (ctx) => {
        const page = Number(ctx.match[1]);
        await ctx.answerCallbackQuery();
        await promptProject(ctx, ctx.from.id, userService, jiraClientFactory, stateManager, page);
    });

    bot.callbackQuery(/^ci-project:(.+)$/, async (ctx) => {
        const key = ctx.match[1] ?? "";
        const userId = ctx.from.id;
        const state = stateManager.getState(userId);
        const project = state.createIssueProjectOptions?.find((option) => option.key === key);

        await ctx.answerCallbackQuery();

        stateManager.setState(userId, {
            ...state,
            createIssueProjectKey: key,
            createIssueProjectName: project?.name,
        });

        await promptSummary(ctx, userId, stateManager);
    });

    bot.callbackQuery("ci-desc-skip", async (ctx) => {
        const userId = ctx.from.id;
        await ctx.answerCallbackQuery();

        stateManager.setState(userId, { ...stateManager.getState(userId), createIssueDescription: undefined });

        await afterFieldCaptured(ctx, userId, userService, stateManager, () =>
            promptPriority(ctx, userId, userService, jiraClientFactory, stateManager),
        );
    });

    bot.callbackQuery(/^ci-priority:(.+)$/, async (ctx) => {
        const priorityId = ctx.match[1] ?? "";
        const userId = ctx.from.id;
        const state = stateManager.getState(userId);
        const priority = state.createIssueOptionsCache?.find((option) => option.id === priorityId);

        await ctx.answerCallbackQuery();

        stateManager.setState(userId, {
            ...state,
            createIssuePriorityId: priorityId,
            createIssuePriorityName: priority?.name,
        });

        await afterFieldCaptured(ctx, userId, userService, stateManager, () =>
            promptAssignee(ctx, userId, userService, jiraClientFactory, stateManager, 1),
        );
    });

    bot.callbackQuery(/^ci-assignee-page:(\d+)$/, async (ctx) => {
        const page = Number(ctx.match[1]);
        await ctx.answerCallbackQuery();
        await promptAssignee(ctx, ctx.from.id, userService, jiraClientFactory, stateManager, page);
    });

    bot.callbackQuery(/^ci-assignee:(.+)$/, async (ctx) => {
        const name = ctx.match[1] ?? "";
        const userId = ctx.from.id;
        const state = stateManager.getState(userId);
        const user = state.createIssueAssigneeOptions?.find((option) => option.name === name);

        await ctx.answerCallbackQuery();

        stateManager.setState(userId, {
            ...state,
            createIssueAssigneeName: name,
            createIssueAssigneeDisplayName: user?.displayName ?? name,
        });

        await afterFieldCaptured(ctx, userId, userService, stateManager, () =>
            promptEstimate(ctx, userId, stateManager),
        );
    });

    bot.callbackQuery("ci-assignee-none", async (ctx) => {
        const userId = ctx.from.id;
        await ctx.answerCallbackQuery();

        stateManager.setState(userId, {
            ...stateManager.getState(userId),
            createIssueAssigneeName: undefined,
            createIssueAssigneeDisplayName: undefined,
        });

        await afterFieldCaptured(ctx, userId, userService, stateManager, () =>
            promptEstimate(ctx, userId, stateManager),
        );
    });

    bot.callbackQuery(/^ci-estimate:(.+)$/, async (ctx) => {
        const preset = ctx.match[1] ?? "";
        const userId = ctx.from.id;

        await ctx.answerCallbackQuery();

        stateManager.setState(userId, { ...stateManager.getState(userId), createIssueEstimate: preset });

        await afterFieldCaptured(ctx, userId, userService, stateManager, () =>
            promptLabels(ctx, userId, stateManager),
        );
    });

    bot.callbackQuery("ci-estimate-skip", async (ctx) => {
        const userId = ctx.from.id;
        await ctx.answerCallbackQuery();

        stateManager.setState(userId, { ...stateManager.getState(userId), createIssueEstimate: undefined });

        await afterFieldCaptured(ctx, userId, userService, stateManager, () =>
            promptLabels(ctx, userId, stateManager),
        );
    });

    bot.callbackQuery("ci-estimate-custom", async (ctx) => {
        const userId = ctx.from.id;
        await ctx.answerCallbackQuery();

        stateManager.setState(userId, {
            ...stateManager.getState(userId),
            step: "create_issue_estimate_custom",
        });

        await ctx.editMessageText(
            ["✏️ زمان تخمینی را وارد کنید.", "", "مثال:", "1h 30m", "3h", "2d"].join("\n"),
            { reply_markup: cancelOnlyKeyboard() },
        );
    });

    bot.callbackQuery("ci-labels-skip", async (ctx) => {
        const userId = ctx.from.id;
        await ctx.answerCallbackQuery();

        stateManager.setState(userId, { ...stateManager.getState(userId), createIssueLabels: undefined });

        await afterFieldCaptured(ctx, userId, userService, stateManager, () =>
            showPreview(ctx, userId, userService, stateManager),
        );
    });

    bot.callbackQuery("ci-preview", async (ctx) => {
        const userId = ctx.from.id;
        await ctx.answerCallbackQuery();
        await showPreview(ctx, userId, userService, stateManager);
    });

    bot.callbackQuery("ci-edit", async (ctx) => {
        await ctx.answerCallbackQuery();
        await ctx.editMessageText("✏️ کدام مورد را می‌خواهید ویرایش کنید؟", {
            reply_markup: editMenuKeyboard(),
        });
    });

    bot.callbackQuery(/^ci-edit-field:(.+)$/, async (ctx) => {
        const field = ctx.match[1];
        const userId = ctx.from.id;

        await ctx.answerCallbackQuery();

        stateManager.setState(userId, { ...stateManager.getState(userId), createIssueEditMode: true });

        if (field === "summary") {
            await promptSummary(ctx, userId, stateManager);
        } else if (field === "description") {
            await promptDescription(ctx, userId, stateManager);
        } else if (field === "priority") {
            await promptPriority(ctx, userId, userService, jiraClientFactory, stateManager);
        } else if (field === "assignee") {
            await promptAssignee(ctx, userId, userService, jiraClientFactory, stateManager, 1);
        } else if (field === "estimate") {
            await promptEstimate(ctx, userId, stateManager);
        } else if (field === "labels") {
            await promptLabels(ctx, userId, stateManager);
        } else {
            stateManager.setState(userId, { ...stateManager.getState(userId), createIssueEditMode: false });
            await showPreview(ctx, userId, userService, stateManager);
        }
    });

    bot.callbackQuery("ci-cancel", async (ctx) => {
        const userId = ctx.from.id;
        await ctx.answerCallbackQuery();

        cancelCreateIssue(userId, stateManager);

        await ctx.editMessageText(
            ["👋 سلام!", "", "از منوی زیر انتخاب کن:"].join("\n"),
            { reply_markup: mainKeyboard() },
        );
    });

    bot.callbackQuery("ci-confirm", async (ctx) => {
        const userId = ctx.from.id;
        const state = stateManager.getState(userId);

        if (state.createIssueSubmitting) return;

        await ctx.answerCallbackQuery();

        if (!state.createIssueProjectKey || !state.createIssueSummary) {
            await ctx.editMessageText("❌ اطلاعات تسک ناقص است. لطفاً دوباره تلاش کنید.");
            stateManager.clearState(userId);
            return;
        }

        stateManager.setState(userId, { ...state, createIssueSubmitting: true });

        await ctx.editMessageText("⏳ در حال ایجاد تسک...");
        await ctx.replyWithChatAction("typing");

        const credentials = await userService.getJiraCredentials(userId);

        if (!credentials) {
            await ctx.editMessageText("❌ ابتدا حساب Jira خود را متصل کنید.");
            stateManager.clearState(userId);
            return;
        }

        try {
            const jiraClient = jiraClientFactory.createForUser(credentials);
            const service = new CreateIssueService(jiraClient);

            const created = await service.createIssue({
                projectKey: state.createIssueProjectKey,
                issueTypeId: DEFAULT_ISSUE_TYPE_ID,
                summary: state.createIssueSummary,
                description: state.createIssueDescription,
                priorityId: state.createIssuePriorityId,
                assigneeName: state.createIssueAssigneeName,
                originalEstimate: state.createIssueEstimate,
                labels: state.createIssueLabels,
            });

            stateManager.clearState(userId);

            const jiraBaseUrl = process.env.JIRA_BASE_URL ?? "";

            await ctx.editMessageText(
                formatCreateIssueSuccess(created.key, state.createIssueSummary),
                {
                    reply_markup: new InlineKeyboard()
                        .text("👁 مشاهده تسک", `issue:${created.key}`)
                        .row()
                        .url("🔗 باز کردن در Jira", `${jiraBaseUrl}/browse/${created.key}`)
                        .row()
                        .text("🏠 منوی اصلی", "back_to_main"),
                },
            );
        } catch (error) {
            console.error(
                "Failed to create issue",
                axios.isAxiosError(error) ? { status: error.response?.status, data: error.response?.data } : error,
            );

            stateManager.setState(userId, { ...stateManager.getState(userId), createIssueSubmitting: false });

            await ctx.editMessageText(classifyCreateError(error), { reply_markup: previewKeyboard() });
        }
    });
}
