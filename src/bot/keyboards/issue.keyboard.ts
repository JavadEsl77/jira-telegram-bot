import { InlineKeyboard } from "grammy";

import type { JiraIssue } from "../../jira/jira.types.js";

export function issueListKeyboard(
    issues: JiraIssue[],
    page: number,
    totalPages: number,
) {
    const keyboard = new InlineKeyboard();

    for (const issue of issues) {
        keyboard
            .text(
                `🎫 ${issue.key}`,
                `issue:${issue.key}`,
            )
            .row();
    }

    if (totalPages > 1) {
        if (page > 1) {
            keyboard.text(
                "◀️ قبلی",
                `my_tasks:${page - 1}`,
            );
        }

        if (page < totalPages) {
            keyboard.text(
                "بعدی ▶️",
                `my_tasks:${page + 1}`,
            );
        }

        keyboard.row();
    }

    return keyboard;
}