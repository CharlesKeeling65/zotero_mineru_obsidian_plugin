const ARTICLE_MARKER = /^article$/i;
const STOP_HEADING = /^(references|bibliography|works cited|acknowledg(?:e)?ments|author contributions|competing interests|supplementary)/i;
const RESULTS_DISCUSSION_HEADING = /results?\s+(and|&)\s+discussion/i;
const AVAILABILITY_HEADING = /^(reporting summary|data availability|code availability)$/i;
/**
 * Remove lightweight Markdown syntax while keeping readable text.
 *
 * 中文：这里不是完整 Markdown parser，只做“足够稳定”的文本清理：
 * 图片去掉，链接保留显示文字，粗体/斜体/代码符号移除，连续空白压缩。
 *
 * English: this is not a full Markdown parser. It performs enough cleanup for
 * paragraph identity and reader text matching.
 */
function stripMarkdownInline(value) {
    return value
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[*_`~]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
function isHeading(line) {
    return /^#{1,6}\s+\S/.test(line.trim());
}
/**
 * Parse a Markdown heading line.
 *
 * 中文知识点：正则 `^(#{1,6})\s+(.+)$` 匹配 ATX heading，例如 `## Methods`。
 * English concept: this regex matches ATX headings such as `## Methods`.
 */
function parseHeading(line) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (!match) {
        return null;
    }
    return {
        level: match[1]?.length ?? 1,
        text: stripMarkdownInline(match[2] ?? "")
    };
}
function headingText(line) {
    return stripMarkdownInline(line.trim().replace(/^#{1,6}\s+/, ""));
}
function isTableParagraph(lines) {
    // 中文：Markdown 表格通常每行以 `|` 包住。表格不应作为普通 text paragraph。
    // English: Markdown table rows are usually pipe-wrapped; do not emit them as text paragraphs.
    return lines.length > 0 && lines.every((line) => /^\s*\|.*\|\s*$/.test(line));
}
/**
 * Convert accumulated lines into one paragraph.
 *
 * 中文：PDF/MinerU 输出常把一个自然段拆成多行，因此这里用空格拼回一段。
 * English: PDF/MinerU output often soft-wraps one paragraph across lines, so join with spaces.
 */
function makeParagraph(textLines) {
    if (textLines.length === 0 || isTableParagraph(textLines)) {
        return null;
    }
    const text = stripMarkdownInline(textLines.join(" "));
    return text.length > 0 ? text : null;
}
/**
 * Select the article body from MinerU Markdown.
 *
 * 中文：MinerU 输出常以 `Article` 开头，并在 `References` 后进入参考文献。
 * 这里从 `Article` 之后开始，到 References/Acknowledgements 等末尾章节之前停止。
 *
 * English: MinerU output often starts with `Article` and later enters references.
 * This returns only the paper body region used for paragraph blocks.
 */
function articleLines(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const articleIndex = lines.findIndex((line) => ARTICLE_MARKER.test(line.trim()));
    const startIndex = articleIndex >= 0 ? articleIndex + 1 : 0;
    const selected = lines.slice(startIndex);
    const stopIndex = selected.findIndex((line) => {
        if (!isHeading(line)) {
            return false;
        }
        return STOP_HEADING.test(headingText(line));
    });
    return stopIndex >= 0 ? selected.slice(0, stopIndex) : selected;
}
/**
 * Map a visible heading to a normalized core paper section.
 *
 * 中文：`section` 保存原始标题，例如 `Divergent estimates...`；
 * `coreSection` 保存通用论文结构，例如 `results`、`methods`。
 * 这样 UI 可以按原文标题显示，也可以按通用类别过滤。
 *
 * English: `section` keeps the original heading, while `coreSection` stores a
 * normalized paper role for filtering/navigation.
 */
function classifyHeading(text) {
    const normalized = text.trim().toLowerCase();
    if (normalized === "abstract") {
        return "abstract";
    }
    if (normalized === "introduction") {
        return "introduction";
    }
    if (RESULTS_DISCUSSION_HEADING.test(normalized)) {
        return "results_discussion";
    }
    if (normalized === "results") {
        return "results";
    }
    if (normalized === "discussion") {
        return "discussion";
    }
    if (normalized.startsWith("methods")) {
        return "methods";
    }
    if (AVAILABILITY_HEADING.test(normalized)) {
        return "availability";
    }
    return null;
}
/**
 * Identify title-page metadata paragraphs.
 *
 * 中文：Nature 类文章标题下会有 Received/Accepted/Published、作者等信息。
 * 这些不是 abstract/introduction，因此归到 `frontmatter`。
 *
 * English: Nature-style papers put dates/authors under the title; those belong
 * to `frontmatter`, not abstract/introduction.
 */
function isMetadataParagraph(text) {
    return (/^(received|accepted|published online):/i.test(text) ||
        /^check for updates$/i.test(text) ||
        /\b\d+(,\d+)*\b/.test(text) && text.length < 180 && /[,&]/.test(text));
}
/**
 * Infer abstract/introduction when headings are missing.
 *
 * 中文：很多期刊没有显式 `Abstract` 和 `Introduction` 标题。
 * 当前策略：
 * - 元数据段 -> `frontmatter`
 * - 标题区第一个非元数据正文段 -> `abstract`
 * - 标题区后续正文段 -> `introduction`
 *
 * English: many journals omit explicit Abstract/Introduction headings.
 * The first substantive title-section paragraph is treated as abstract; later
 * title-section paragraphs are introduction.
 */
function inferTitleSectionRole(text, titleSectionParagraphCount) {
    if (isMetadataParagraph(text)) {
        return "frontmatter";
    }
    if (titleSectionParagraphCount === 0) {
        return "abstract";
    }
    return "introduction";
}
/**
 * Split MinerU Markdown into ordered raw text blocks.
 *
 * 中文主流程：
 * 1. 取 Article 正文；
 * 2. 用标题更新当前 section/coreSection；
 * 3. 用空行切自然段；
 * 4. 给每段生成 RawMineruBlock；
 * 5. 显式写入 `order`，后续 block ID 不依赖临时数组索引。
 *
 * English workflow:
 * 1. select article body;
 * 2. update current section/coreSection from headings;
 * 3. split paragraphs on blank lines;
 * 4. emit RawMineruBlock for each paragraph;
 * 5. preserve explicit order for stable downstream processing.
 *
 * Parameters:
 * 中文：`markdown` 是 MinerU 下载的完整 Markdown；`options.title` 可来自 Zotero 元数据。
 * English: `markdown` is the full MinerU Markdown; `options.title` can come from Zotero metadata.
 */
export function markdownToTextBlocks(markdown, options = {}) {
    const blocks = [];
    const paragraphLines = [];
    let currentSection = options.title ?? "Article";
    let currentCoreSection = "other";
    let titleSection = options.title ?? null;
    let titleSectionContentBlocks = 0;
    const flush = () => {
        // 中文：flush 是“把当前缓存段落落盘为 block”的内部函数。
        // English: flush turns buffered paragraph lines into one block.
        const text = makeParagraph(paragraphLines);
        paragraphLines.length = 0;
        if (!text) {
            return;
        }
        const coreSection = titleSection && currentSection === titleSection
            ? inferTitleSectionRole(text, titleSectionContentBlocks)
            : currentCoreSection;
        blocks.push({
            type: "text",
            section: currentSection,
            coreSection,
            pageStart: 1,
            pageEnd: 1,
            order: blocks.length + 1,
            text,
            markdown: text
        });
        // 中文：只统计标题区正文段，不统计 frontmatter，这样第一段正文能正确推断为 abstract。
        // English: count only substantive title-section paragraphs so the first becomes abstract.
        if (titleSection && currentSection === titleSection && coreSection !== "frontmatter") {
            titleSectionContentBlocks += 1;
        }
    };
    for (const line of articleLines(markdown)) {
        const trimmed = line.trim();
        if (!trimmed) {
            flush();
            continue;
        }
        const heading = parseHeading(trimmed);
        if (heading) {
            flush();
            currentSection = heading.text || currentSection;
            // 中文：第一层标题通常是论文题名，用它锁定“标题区段”。
            // English: the first level-1 heading is usually the paper title section.
            if (heading.level === 1 && blocks.length === 0) {
                titleSection = currentSection || options.title || null;
            }
            // 中文：没有识别到的子标题会继承上一核心章节，例如 Results 下的小节。
            // English: unrecognized subheadings inherit the previous core section.
            currentCoreSection = classifyHeading(currentSection) ?? currentCoreSection;
            continue;
        }
        paragraphLines.push(trimmed);
    }
    flush();
    return blocks;
}
/**
 * Ensure raw MinerU data has text blocks before normalization.
 *
 * 中文：如果 MinerU 未来返回结构化 blocks，则直接信任 provider-supplied blocks；
 * 如果只返回 Markdown，则使用本文件的 fallback 拆分。
 *
 * English: if MinerU/provider supplies blocks, keep them. If not, fall back to
 * Markdown paragraph splitting.
 */
export function ensureMarkdownTextBlocks(raw) {
    if (raw.blocks.length > 0) {
        return raw;
    }
    return {
        ...raw,
        blocks: markdownToTextBlocks(raw.markdown, { title: raw.title })
    };
}
