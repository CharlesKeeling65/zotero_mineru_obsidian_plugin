/**
 * 统一的翻译注释颜色 / Unified translation annotation color.
 *
 * 中文：Zotero 注释颜色用 hex 字符串。灰色用于区分“机器/AI 翻译卡片”
 * 和用户手工高亮，避免视觉上混淆。
 *
 * English: Zotero uses hex colors. Gray distinguishes generated translation
 * cards from user-created highlights.
 */
export const GRAY_TRANSLATION_ANNOTATION_COLOR = "#aaaaaa";
const TRANSLATION_TAG = "mineru-translation";
function hashString(value) {
    let hash = 2166136261;
    for (const character of value) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function makeZoteroKey(value) {
    // 中文：Zotero annotation key 通常是 8 位大写字母/数字风格；这里生成稳定伪 key。
    // English: generate a stable 8-character Zotero-like key for deterministic payloads.
    return hashString(value).toString(36).toUpperCase().padStart(8, "0").slice(-8);
}
function padSortPart(value) {
    return value.toString().padStart(5, "0");
}
function makeSortIndex(translation) {
    const pageIndex = Math.max(0, translation.pageRange.start - 1);
    return `${padSortPart(pageIndex)}|${translation.order.toString().padStart(6, "0")}|00000`;
}
/**
 * Convert translated blocks into Zotero annotation JSON payloads.
 *
 * 中文字段映射：
 * - `text`：原文段落，显示为注释卡片上方引用。
 * - `comment`：译文，显示为注释卡片正文。
 * - `color`：统一灰色。
 * - `position.rects`：来自 Reader text-location 的 PDF 矩形。
 * - `tags`：统一 `mineru-translation`，方便筛选/删除/同步。
 *
 * English field mapping:
 * - `text`: source quote;
 * - `comment`: translation;
 * - `color`: unified gray;
 * - `position.rects`: Reader PDF rectangles;
 * - `tags`: generated annotation marker.
 */
export function buildTranslationAnnotationPayloads(translations, options = {}) {
    return translations.map((translation) => {
        const textLocation = options.textLocations?.get(translation.blockId);
        const pageIndex = textLocation?.pageIndex ?? Math.max(0, translation.pageRange.start - 1);
        const pageLabel = textLocation?.pageLabel ?? String(translation.pageRange.start);
        return {
            key: makeZoteroKey(`${translation.blockId}:${translation.sourceText}`),
            type: "highlight",
            text: translation.sourceText,
            comment: translation.translation,
            color: GRAY_TRANSLATION_ANNOTATION_COLOR,
            pageLabel,
            // 中文：sortIndex 影响 Reader 侧边栏顺序，格式保持 page/order 的可排序字符串。
            // English: sortIndex controls sidebar order; keep it page/order sortable.
            sortIndex: textLocation
                ? `${padSortPart(pageIndex)}|${translation.order.toString().padStart(6, "0")}|00000`
                : makeSortIndex(translation),
            position: {
                pageIndex,
                rects: textLocation?.rects ?? []
            },
            tags: [{ name: TRANSLATION_TAG }]
        };
    });
}
/**
 * Runtime writer backed by `Zotero.Annotations.saveFromJSON`.
 *
 * 中文：这是最后一步的 Zotero 适配器。它接收 payload，不负责翻译或定位。
 * 这种分层方便在没有 Zotero runtime 的 Node 测试环境中测试前面所有逻辑。
 *
 * English: final Zotero adapter. It receives payloads only; translation/location
 * logic is already done before this layer.
 */
export class RuntimeZoteroAnnotationWriter {
    input;
    constructor(input) {
        this.input = input;
    }
    async createTranslationAnnotations(annotations) {
        for (const annotation of annotations) {
            // 中文：`skipSelect` 避免每写入一个注释就抢占 UI 选择状态。
            // English: `skipSelect` avoids stealing Reader selection after each write.
            await this.input.zotero.Annotations.saveFromJSON(this.input.attachment, annotation, { skipSelect: true });
        }
        return annotations.length;
    }
}
