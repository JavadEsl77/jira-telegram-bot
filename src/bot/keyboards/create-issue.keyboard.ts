import { InlineKeyboard } from "grammy";

/** پیش‌تنظیم‌های Original Estimate — مستقیماً در فرمت pretty-duration موردقبول Jira */
export const ESTIMATE_PRESETS = ["30m", "1h", "2h", "4h", "8h", "1d", "2d"];

/** کیبورد فقط شامل دکمه لغو — برای مراحلی که منتظر ورودی متنی هستند */
export function cancelOnlyKeyboard() {
    return new InlineKeyboard().text("❌ لغو", "ci-cancel");
}

export function projectKeyboard(
    projects: { key: string; name: string }[],
    page: number,
    totalPages: number,
) {
    const keyboard = new InlineKeyboard();
    for (const project of projects) {
        keyboard.text(`📁 ${project.key} - ${project.name}`, `ci-project:${project.key}`).row();
    }

    if (totalPages > 1) {
        if (page > 1) keyboard.text("◀️ قبلی", `ci-project-page:${page - 1}`);
        if (page < totalPages) keyboard.text("بعدی ▶️", `ci-project-page:${page + 1}`);
        keyboard.row();
    }

    keyboard.text("❌ لغو", "ci-cancel");
    return keyboard;
}

export function descriptionKeyboard() {
    return new InlineKeyboard()
        .text("⏭ رد کردن", "ci-desc-skip")
        .row()
        .text("❌ لغو", "ci-cancel");
}

export function priorityKeyboard(priorities: { id: string; name: string }[], priorityEmoji: (name: string) => string) {
    const keyboard = new InlineKeyboard();
    for (const priority of priorities) {
        keyboard.text(`${priorityEmoji(priority.name)} ${priority.name}`, `ci-priority:${priority.id}`).row();
    }
    keyboard.text("❌ لغو", "ci-cancel");
    return keyboard;
}

export function assigneeKeyboard(
    users: { name: string; displayName: string }[],
    page: number,
    hasNextPage: boolean,
) {
    const keyboard = new InlineKeyboard();
    for (const user of users) {
        keyboard.text(`👤 ${user.displayName}`, `ci-assignee:${user.name}`).row();
    }

    if (page > 1 || hasNextPage) {
        if (page > 1) keyboard.text("◀️ قبلی", `ci-assignee-page:${page - 1}`);
        if (hasNextPage) keyboard.text("بعدی ▶️", `ci-assignee-page:${page + 1}`);
        keyboard.row();
    }

    keyboard.text("⏭ بدون مسئول", "ci-assignee-none").row();
    keyboard.text("❌ لغو", "ci-cancel");
    return keyboard;
}

export function estimateKeyboard() {
    const keyboard = new InlineKeyboard();
    for (const preset of ESTIMATE_PRESETS) {
        keyboard.text(preset, `ci-estimate:${preset}`);
    }
    keyboard.row();
    keyboard.text("✏️ مقدار دلخواه", "ci-estimate-custom").row();
    keyboard.text("⏭ بدون Estimate", "ci-estimate-skip").row();
    keyboard.text("❌ لغو", "ci-cancel");
    return keyboard;
}

export function labelsKeyboard() {
    return new InlineKeyboard()
        .text("⏭ رد کردن", "ci-labels-skip")
        .row()
        .text("❌ لغو", "ci-cancel");
}

export function previewKeyboard() {
    return new InlineKeyboard()
        .text("✅ ایجاد تسک", "ci-confirm")
        .row()
        .text("✏️ ویرایش", "ci-edit")
        .row()
        .text("❌ لغو", "ci-cancel");
}

export function editMenuKeyboard() {
    return new InlineKeyboard()
        .text("🎫 عنوان", "ci-edit-field:summary")
        .row()
        .text("📄 توضیحات", "ci-edit-field:description")
        .row()
        .text("⚡ اولویت", "ci-edit-field:priority")
        .row()
        .text("👤 مسئول", "ci-edit-field:assignee")
        .row()
        .text("⏱ Estimate", "ci-edit-field:estimate")
        .row()
        .text("🏷 Labels", "ci-edit-field:labels")
        .row()
        .text("◀️ بازگشت به پیش‌نمایش", "ci-preview");
}
