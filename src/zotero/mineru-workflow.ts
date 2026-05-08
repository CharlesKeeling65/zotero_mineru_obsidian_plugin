import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

import type { MineruProvider } from "../mineru/client.js";
import type { NormalizedDocument } from "../normalize/normalizer.js";
import { ParseService } from "../parse/parse-service.js";
import type { ParseCache } from "../parse/parse-cache.js";
import type { TranslationProvider } from "../translate/provider.js";
import { translateDocumentTextBlocks } from "../translate/contextual-translator.js";
import type { ZoteroReaderTextLocationProvider } from "./text-location.js";
import { resolveTextLocationsForTranslations } from "./text-location.js";
import {
  buildTranslationAnnotationPayloads,
  type TranslationAnnotationWriter,
  type ZoteroTranslationAnnotationPayload
} from "./annotations.js";
import { resolvePdfSelection, type ResolvePdfSelectionInput } from "./selection.js";

/**
 * End-to-end input for the Zotero -> MinerU -> normalized document workflow.
 *
 * 中文：这是插件核心工作流的“依赖注入”入口。调用者传入 Zotero 选中的条目、
 * MinerU provider，以及可选的翻译/定位/注释 writer。这样主流程不直接绑定全局
 * Zotero 对象，也不直接绑定某个翻译服务，便于单元测试和后续替换实现。
 *
 * English: This is the dependency-injection boundary for the core workflow.
 * The caller provides the selected Zotero item, MinerU provider, and optional
 * translation/location/annotation services. The workflow therefore stays
 * independent from global Zotero objects and specific translation vendors.
 */
export interface ParseSelectedPdfWithMineruInput extends ResolvePdfSelectionInput {
  /** 中文：MinerU API 适配器；English: MinerU API adapter implementation. */
  provider: MineruProvider;
  /** 中文：用于内部 Document 标题；English: title used in the normalized Document. */
  title: string;
  /** 中文：可选翻译接口；不传则只完成解析/标准化。English: optional translation provider. */
  translationProvider?: TranslationProvider;
  /** 中文：可选 Reader 文本定位接口；用于把段落映射到 PDF rects。English: optional PDF text locator. */
  textLocationProvider?: ZoteroReaderTextLocationProvider;
  /** 中文：可选 Zotero 注释写入器；用于创建灰色翻译卡片。English: optional annotation writer. */
  annotationWriter?: TranslationAnnotationWriter;
}

/**
 * Output returned after parsing a selected PDF.
 *
 * 中文：`normalized` 是插件后续 UI/export/AI 都应该消费的内部模型；
 * `outputDir` 是 PDF 所在父目录，也就是 MinerU markdown/raw 输出位置。
 *
 * English: `normalized` is the internal model consumed by later UI/export/AI
 * layers. `outputDir` is the selected PDF's parent folder where raw outputs
 * are persisted.
 */
export interface ParseSelectedPdfWithMineruOutput {
  normalized: NormalizedDocument;
  outputDir: string;
  translationAnnotations?: {
    annotations: ZoteroTranslationAnnotationPayload[];
    createdCount: number;
  };
}

/**
 * Parse cache that writes MinerU outputs beside the source PDF.
 *
 * 中文：用户要求“返回文件储存在指定条目 PDF 相同父文件夹下，并且命名和 PDF 保持一致”。
 * 这个 cache 实现了该命名策略：
 * - MinerU 返回 `full.md` 时写成 `<pdfBaseName>.md`
 * - 其它 raw 文件写成 `<pdfBaseName>.<rawSuffix>.<ext>`
 *
 * English: This cache implements the requested sibling-output convention:
 * `full.md` becomes `<pdfBaseName>.md`; other raw artifacts are namespaced
 * under the same PDF base name.
 */
class PdfSiblingParseCache implements ParseCache {
  public constructor(
    private readonly outputDir: string,
    private readonly pdfBaseName: string
  ) {}

  public async writeRawFile(name: string, content: string): Promise<void> {
    // 中文：确保 PDF 父目录存在；English: make the PDF parent folder available.
    await mkdir(this.outputDir, { recursive: true });
    await writeFile(join(this.outputDir, this.resolveOutputName(name)), content, "utf8");
  }

  private resolveOutputName(name: string): string {
    const extension = extname(name);
    if (!extension) {
      // 中文：没有扩展名时只能保留 PDF 基名；English: no extension, keep the PDF base name.
      return this.pdfBaseName;
    }

    if (name.startsWith(`${this.pdfBaseName}.`)) {
      // 中文：如果上游已经按 PDF 命名，则不要重复加前缀；English: avoid double-prefixing.
      return name;
    }

    const suffix = basename(name, extension);
    // 中文：`full.md` 是主要 Markdown，直接与 PDF 同名，方便用户在文件夹中识别。
    // English: `full.md` is the main Markdown output, so it shares the PDF base name.
    return suffix === "full"
      ? `${this.pdfBaseName}${extension}`
      : `${this.pdfBaseName}.${suffix}${extension}`;
  }
}

/**
 * Core Zotero plugin workflow.
 *
 * 中文流程：
 * 1. 从 Zotero 当前选择解析出 PDF attachment。
 * 2. 用 PDF 父目录创建 cache，保证 MinerU 原始结果写回同一文件夹。
 * 3. 调用 ParseService：MinerU 解析 -> 写 raw 文件 -> Markdown 分块 -> 内部模型标准化。
 * 4. 如果配置了翻译和注释 writer，则逐段翻译，再尽量用 Reader text location 找到 PDF rects。
 * 5. 构造 Zotero highlight annotation payload，并写入 Zotero 侧边注释栏。
 *
 * English flow:
 * 1. Resolve the selected Zotero PDF attachment.
 * 2. Create a sibling parse cache rooted at the PDF parent folder.
 * 3. Run ParseService: MinerU parse -> raw persistence -> Markdown block split -> normalization.
 * 4. If translation and annotation writer are configured, translate blocks and resolve PDF rects.
 * 5. Build Zotero highlight annotations and write them into the reader sidebar.
 *
 * 后续开发 / Future extension:
 * - 接入真实 Zotero runtime 时，只需实现 `TranslationAnnotationWriter` 和
 *   `ZoteroReaderTextLocationProvider`，不要把 runtime 细节塞进 normalize/parse 层。
 * - Export、UI、AI agent 应消费 `NormalizedDocument`，不要直接消费 MinerU raw JSON。
 */
export async function parseSelectedPdfWithMineru(
  input: ParseSelectedPdfWithMineruInput
): Promise<ParseSelectedPdfWithMineruOutput> {
  // 中文：Zotero 可能选中父条目或 PDF attachment；selection 层负责兼容这些形态。
  // English: selection layer supports either parent item or direct PDF attachment selection.
  const selection = resolvePdfSelection({ selectedItem: input.selectedItem });
  const pdfPath = selection.attachment.path;
  const outputDir = dirname(pdfPath);
  const pdfBaseName = basename(pdfPath, extname(pdfPath));
  // 中文：优先使用父条目的 key 做 document identity，attachment key 作为 fallback。
  // English: prefer parent item key for document identity; fallback to attachment key.
  const zoteroItemKey = selection.parentItemKey ?? selection.attachment.key;
  const service = new ParseService({
    provider: input.provider,
    cache: new PdfSiblingParseCache(outputDir, pdfBaseName)
  });

  const normalized = await service.parse({
    docId: `zotero_${zoteroItemKey}`,
    zoteroItemKey,
    pdfPath,
    title: input.title
  });

  if (input.translationProvider && input.annotationWriter) {
    // 中文：翻译是可选增强层；它读取 block，不修改 raw block 内容，符合 AI 输出分离原则。
    // English: translation is an optional derived layer; it does not mutate raw block content.
    const translations = await translateDocumentTextBlocks(
      normalized,
      input.translationProvider
    );
    // 中文：只有 provider 存在时才尝试精确定位 PDF rects；没有 rects 时仍可生成注释 payload。
    // English: exact PDF rect matching is attempted only when a location provider is supplied.
    const textLocations = input.textLocationProvider
      ? await resolveTextLocationsForTranslations(
          translations,
          input.textLocationProvider
      )
      : undefined;
    // 中文：payload 构造与 Zotero 写入分离，方便测试 sortIndex/color/tags/position。
    // English: payload construction is separate from runtime writes for testability.
    const annotations = buildTranslationAnnotationPayloads(translations, {
      textLocations
    });
    const createdCount = await input.annotationWriter.createTranslationAnnotations(
      annotations
    );

    return {
      normalized,
      outputDir,
      translationAnnotations: {
        annotations,
        createdCount
      }
    };
  }

  return { normalized, outputDir };
}
