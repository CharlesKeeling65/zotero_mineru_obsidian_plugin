import type { RawMineruDocument, RawMineruFile } from "../types/mineru.js";

/**
 * Input contract for any MinerU provider implementation.
 *
 * 中文：这是插件调用 MinerU 的统一入口参数。无论后面接 Agent API、
 * Standard API、还是本地 MinerU，都应该接受这个形状，然后返回同一个
 * `ParsePdfOutput`，这样上层 ParseService 不需要跟着后端变化。
 *
 * English: unified input for all MinerU providers. Agent API, Standard API, and
 * future local backends should accept this shape so ParseService remains stable.
 */
export interface ParsePdfInput {
  /** 中文：内部文档 ID；English: internal stable document identifier. */
  docId: string;
  /** 中文：Zotero 条目 key，用于追溯来源；English: source Zotero item key. */
  zoteroItemKey: string;
  /** 中文：本地 PDF 路径；English: local PDF file path. */
  pdfPath: string;
  /** 中文：论文标题；English: paper title. */
  title: string;
}

/**
 * Output contract from MinerU providers.
 *
 * 中文：`document` 是标准化前的 raw MinerU document；`rawFiles` 是需要保存到
 * cache 的原始文件，例如 markdown、layout JSON、或后续可能的图片资源列表。
 *
 * English: `document` is the raw MinerU document before normalization, while
 * `rawFiles` are traceable artifacts that should be persisted by the parse cache.
 */
export interface ParsePdfOutput {
  document: RawMineruDocument;
  rawFiles: RawMineruFile[];
}

/**
 * Provider port for MinerU backends.
 *
 * 中文：这是典型的“端口 / port”接口。业务层依赖接口，不依赖具体 API 客户端；
 * 新增 provider 时实现 `backendName` 和 `parsePdf` 即可。
 *
 * English: a classic port interface. Business code depends on this contract,
 * not on a concrete HTTP client.
 */
export interface MineruProvider {
  /** 中文：记录后端来源，例如 mineru-agent；English: backend label for provenance. */
  readonly backendName: string;
  parsePdf(input: ParsePdfInput): Promise<ParsePdfOutput>;
}
