import type { Asset, Block, Chunk, Document, Relation } from "../model/index.js";
import { DOCUMENT_SCHEMA_VERSION } from "../model/index.js";
import type { RawMineruBlock, RawMineruDocument } from "../types/mineru.js";
import { convertBlocksToChunks, type ChunkConfig, DEFAULT_CHUNK_CONFIG } from "./chunk-converter.js";
import { EnhancedChunkConverter, createEnhancedChunkConverter, type EnhancedChunkConfig, type MineruAdvancedParseResult, DEFAULT_ENHANCED_CHUNK_CONFIG } from "./enhanced-chunk-converter.js";

/**
 * The normalized document bundle used by UI/export/AI layers.
 *
 * 中文：这是 MinerU 原始输出和 Zotero UI 之间的“内部标准格式”。
 * 后续界面、导出、AI 不应直接读 MinerU Markdown，而应读这里的 normalized entities。
 * 新增 chunks 字段用于支持 RAG 检索系统。
 *
 * English: this is the internal contract between raw MinerU output and UI/export/AI.
 * Downstream layers should consume these normalized entities instead of raw Markdown.
 * The new chunks field supports RAG retrieval system.
 */
export interface NormalizedDocument {
  document: Document;
  blocks: Block[];
  chunks: Chunk[];
  assets: Asset[];
  relations: Relation[];
}

/**
 * Create a short URL/file-system-friendly slug segment.
 *
 * 中文：block ID 需要可读但不能太长，所以标题只取前 24 个 slug 字符。
 * English: block IDs should be readable but short, so section slugs are truncated.
 */
function toSlugPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

/**
 * Build a semantic fingerprint from stable block inputs.
 *
 * 中文：fingerprint 不使用当前数组索引，而使用 type/section/page/text 等结构信息。
 * 这样同一篇文章重复 normalize 时，block ID 更稳定。
 *
 * English: avoid transient indexes; use structural inputs so IDs remain stable
 * across repeated normalization.
 */
function makeFingerprint(block: RawMineruBlock): string {
  return [
    block.type,
    block.section,
    block.subsection ?? "",
    `${block.pageStart}-${block.pageEnd}`,
    block.caption ?? "",
    block.text ?? "",
    block.markdown ?? ""
  ].join("|");
}

/**
 * FNV-1a style string hash.
 *
 * 中文知识点：这是一个轻量 deterministic hash，不是加密哈希。
 * 用途只是生成短 ID，不适合安全场景。
 *
 * English concept: lightweight deterministic hash for IDs, not cryptographic security.
 */
function hashString(value: string): string {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0).toString(36);
}

/**
 * Create the stable block ID consumed by all downstream layers.
 *
 * 中文格式：`docId:type:semanticPrefix:fingerprint`。
 * 后续如果 block 顺序变化，只要结构文本不变，ID 仍尽量稳定。
 *
 * English format: `docId:type:semanticPrefix:fingerprint`.
 * This preserves identity better than `docId:type:order`.
 */
function makeStableBlockId(docId: string, block: RawMineruBlock): string {
  const semanticPrefix = [
    block.section,
    block.subsection ?? "",
    `${block.pageStart}-${block.pageEnd}`
  ]
    .filter(Boolean)
    .map(toSlugPart)
    .filter(Boolean)
    .join("-");

  const fingerprint = hashString(makeFingerprint(block));
  return `${docId}:${block.type}:${semanticPrefix || "block"}:${fingerprint}`;
}

/**
 * Build a shallow section tree for navigation.
 *
 * 中文：当前只按第一层 sectionPath 聚合，用于最小 Outline。
 * 后续可以扩展成多层树：一级章节 -> 二级小节 -> block ids。
 *
 * English: currently groups by the first section path segment for a minimal outline.
 * It can later be expanded into a true nested tree.
 */
function makeSectionTree(blocks: Block[]): Document["sectionTree"] {
  const sections = new Map<string, Document["sectionTree"][number]>();

  for (const block of blocks) {
    const titles = block.sectionPath.length > 0 ? [block.sectionPath[0] ?? "Unsectioned"] : ["Unsectioned"];
    const sectionKey = titles[0] ?? "Unsectioned";

    if (!sections.has(sectionKey)) {
      sections.set(sectionKey, {
        id: `section:${hashString(sectionKey)}`,
        title: titles[0] ?? "Unsectioned",
        level: titles.length,
        path: titles,
        blockIds: []
      });
    }

    sections.get(sectionKey)?.blockIds.push(block.blockId);
  }

  return [...sections.values()];
}

/**
 * Create simple `precedes` relations between consecutive blocks.
 *
 * 中文：这让系统知道 block 的阅读顺序，也为后续 AI 上下文窗口提供基础关系。
 * English: consecutive `precedes` relations preserve reading order and help future AI context windows.
 */
function makeRelations(documentId: string, blocks: Block[]): Relation[] {
  return blocks.flatMap((block, index) => {
    if (index === 0) {
      return [];
    }

    const previous = blocks[index - 1];
    if (!previous) {
      return [];
    }

    return [
      {
        relationId: `${documentId}:precedes:${previous.blockId}:${block.blockId}`,
        documentId,
        sourceBlockId: previous.blockId,
        targetBlockId: block.blockId,
        type: "precedes",
        confidence: 1,
        provenance: "system"
      }
    ];
  });
}

/**
 * Normalize MinerU-shaped raw data into the internal schema.
 *
 * 中文主流程：
 * - 给每个 raw block 生成稳定 `blockId`；
 * - 保留 `coreSection`、sectionPath、pageRange、order；
 * - 构建 sectionTree 和 block relation；
 * - 生成 Document 统计信息；
 * - 生成 Chunk 用于 RAG 检索。
 *
 * 参数：
 * - `raw`：MinerU provider 或 Markdown fallback 产生的数据。
 * - `parseBackend`：记录来源，例如 `agent`、`standard`、`local`。
 * - `chunkConfig`：Chunk 生成配置，可选。
 * - `embeddingModel`：嵌入模型名称，可选。
 *
 * English workflow:
 * - assign stable block IDs;
 * - preserve coreSection/sectionPath/pageRange/order;
 * - build section tree and relations;
 * - generate Document statistics;
 * - generate Chunks for RAG retrieval.
 */
export function normalizeMineruDocument(
  raw: RawMineruDocument,
  parseBackend = "agent",
  chunkConfig?: ChunkConfig,
  embeddingModel?: string,
  advancedParseResult?: MineruAdvancedParseResult
): NormalizedDocument {
  const blocks: Block[] = raw.blocks.map((block) => ({
    blockId: makeStableBlockId(raw.docId, block),
    documentId: raw.docId,
    type: block.type,
    coreSection: block.coreSection ?? "other",
    subtype: null,
    sectionPath: [block.section, block.subsection].filter(
      (value): value is string => Boolean(value)
    ),
    pageRange: {
      start: block.pageStart,
      end: block.pageEnd
    },
    order: block.order,
    content: {
      text: block.text ?? null,
      markdown: block.markdown ?? block.text ?? null
    },
    caption: block.caption ?? null,
    assetIds: [],
    relatedBlockIds: [],
    tags: [],
    sourceFingerprint: hashString(makeFingerprint(block))
  }));

  const relations = makeRelations(raw.docId, blocks);
  const sectionTree = makeSectionTree(blocks);
  
  // 生成 Chunks 用于 RAG 检索
  // 如果有高级 API 结果，使用增强型 Chunk 转换器
  let chunks: Chunk[];
  if (advancedParseResult) {
    const enhancedConverter = createEnhancedChunkConverter(
      { ...DEFAULT_ENHANCED_CHUNK_CONFIG, ...chunkConfig },
      advancedParseResult
    );
    chunks = blocks.flatMap((block, index) => {
      const prevBlock = index > 0 ? blocks[index - 1] : undefined;
      const nextBlock = index < blocks.length - 1 ? blocks[index + 1] : undefined;
      return enhancedConverter.convertBlockToChunks({
        block,
        context: {
          beforeText: prevBlock?.content.text ?? null,
          afterText: nextBlock?.content.text ?? null,
          section: block.sectionPath[0] ?? "",
          subsection: block.sectionPath[1] ?? null,
        },
        itemKey: raw.zoteroItemKey,
        documentId: raw.docId,
        embeddingModel
      });
    });
  } else {
    chunks = convertBlocksToChunks(
      blocks,
      raw.zoteroItemKey,
      raw.docId,
      chunkConfig || DEFAULT_CHUNK_CONFIG,
      embeddingModel
    );
  }

  return {
    document: {
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      documentId: raw.docId,
      source: {
        zoteroItemKey: raw.zoteroItemKey,
        title: raw.title
      },
      title: raw.title,
      parse: {
        engine: "mineru",
        backend: parseBackend,
        parsedAt: null
      },
      fullMarkdown: raw.markdown,
      sectionTree,
      stats: {
        blockCount: blocks.length,
        chunkCount: chunks.length,
        assetCount: 0,
        relationCount: relations.length
      },
      status: "parsed"
    },
    blocks,
    chunks,
    assets: [],
    relations
  };
}
