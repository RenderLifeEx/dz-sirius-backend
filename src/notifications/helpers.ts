import { Lesson } from "../diary/parser";

export const GROUP_1_LABEL = "      👩🏽 Группа 1 (Вероника Олеговна)";
export const GROUP_2_LABEL = "      👩🏻 Группа 2 (Анушик Гургеновна)";

export const EMOJI_NUMBERS = [
    "1️⃣",
    "2️⃣",
    "3️⃣",
    "4️⃣",
    "5️⃣",
    "6️⃣",
    "7️⃣",
    "8️⃣",
    "9️⃣",
    "🔟",
];

/**
 * Собирает текст уведомления о ДЗ.
 * @param bold — функция обёртки жирного текста (разная для Telegram и MAX)
 */
export function buildHomeworkMessage(
    date: string,
    homeworkItems: Lesson[],
    bold: (text: string) => string,
    isUpdate?: boolean,
): string {
    const header = isUpdate
        ? bold(`❗️ДЗ на ${date} было обновлено ❗️`)
        : bold(`ДЗ на ${date}`);

    const lines: string[] = [header, ""];

    homeworkItems.forEach((item, index) => {
        const emoji = index < EMOJI_NUMBERS.length ? EMOJI_NUMBERS[index] : `${index + 1}.`;

        lines.push(`${emoji} ${bold(item.subject)}`);

        if (item.task_group_1 !== undefined) {
            lines.push(GROUP_1_LABEL);
            lines.push(`      ${item.task_group_1.trim() || "—"}`);
            lines.push(GROUP_2_LABEL);
            lines.push(`      ${item.task.trim() || "—"}`);
        } else {
            lines.push(`      ${item.task.trim() || "—"}`);
        }

        lines.push("");
    });

    lines.push("📅 Расписание на неделю: https://dz.renderlife.ru/");

    return lines.join("\n");
}
