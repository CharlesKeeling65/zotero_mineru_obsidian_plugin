import type { BlockType } from "./block.js";

/**
 * Chunk represents a searchable unit in the RAG system.
 * 
 * 中文：Chunk 是 RAG 检索系统的最小检索单元。一个 Block 可能对应多个 Chunk，
 * 特别是当 Block 内容较长时需要拆分；多个短 Block 也可能合并成一个 Chunk。
 * Chunk 包含检索所需的元数据和上下文信息。
 * 
 * English: Chunk is the smallest retrieval unit in the RAG system. One Block may
 * correspond to multiple Chunks (when content is long), or multiple short Blocks
 * may be merged into one Chunk. Chunks contain metadata and context for retrieval.
 */
export interface Chunk {
  /** 唯一标识符，格式：{item_key}_{block_id}_c{chunk_index} */
  chunkId: string;
  
  /** 关联的 Zotero 条目 key */
  itemKey: string;
  
  /** 关联的文档 ID */
  documentId: string;
  
  /** 关联的 Block ID */
  blockId: string;
  
  /** Chunk 级别：paragraph（段落）、section（章节）、merged（合并） */
  chunkLevel: "paragraph" | "section" | "merged";
  
  /** 主要文本内容 */
  text: string;
  
  /** Markdown 格式内容 */
  contentMarkdown: string | null;
  
  /** 上下文信息 */
  context: ChunkContext;
  
  /** 元数据 */
  metadata: ChunkMetadata;
  
  /** 检索信息 */
  retrieval: ChunkRetrievalInfo;
}

/**
 * Context information for a chunk.
 * 
 * 中文：Chunk 的上下文信息，包括前后文、所在章节等，用于检索时提供更完整的语境。
 * English: Context information for a chunk, including surrounding text and section info,
 * to provide better context during retrieval.
 */
export interface ChunkContext {
  /** 前一个 Block 的文本（如果存在） */
  before: string | null;
  
  /** 后一个 Block 的文本（如果存在） */
  after: string | null;
  
  /** 所在章节标题 */
  section: string;
  
  /** 所在子章节标题 */
  subsection: string | null;
  
  /** 章节路径（从根到当前） */
  sectionPath: string[];
}

/**
 * Metadata for a chunk.
 * 
 * 中文：Chunk 的元数据，包括类型、页码、顺序等信息，用于过滤和排序。
 * English: Metadata for a chunk, including type, page, order information for filtering and sorting.
 */
export interface ChunkMetadata {
  /** Block 类型：text、figure、table、formula */
  blockType: BlockType;
  
  /** Block 子类型 */
  subtype: string | null;
  
  /** 起始页码（1-based） */
  pageStart: number;
  
  /** 结束页码（1-based） */
  pageEnd: number;
  
  /** 在文档中的顺序 */
  order: number;
  
  /** Token 数量（估算） */
  tokenCount: number;
  
  /** 文本哈希（用于去重） */
  textHash: string;
  
  /** 创建时间 */
  createdAt: string;
  
  /** 嵌入模型（如果已计算） */
  embeddingModel: string | null;
  
  /** 嵌入向量（如果已计算） */
  embedding: number[] | null;
}

/**
 * Retrieval information for a chunk.
 * 
 * 中文：Chunk 的检索信息，包括检索分数、来源等，用于检索结果排序和展示。
 * English: Retrieval information for a chunk, including scores and sources for result ranking and display.
 */
export interface ChunkRetrievalInfo {
  /** 综合检索分数 */
  score: number;
  
  /** BM25 检索分数 */
  bm25Score: number | null;
  
  /** 向量检索分数 */
  vectorScore: number | null;
  
  /** 重排序分数 */
  rerankScore: number | null;
  
  /** 检索来源 */
  retrievalSource: "bm25" | "vector" | "hybrid" | "rerank";
  
  /** 为什么相关（可选，用于解释） */
  whyRelevant: string | null;
}

/**
 * Input for creating a chunk from a block.
 * 
 * 中文：从 Block 创建 Chunk 的输入参数，包含 Block 数据和上下文信息。
 * English: Input parameters for creating a chunk from a block, including block data and context.
 */
export interface CreateChunkInput {
  /** 关联的 Zotero 条目 key */
  itemKey: string;
  
  /** 关联的文档 ID */
  documentId: string;
  
  /** Block 数据 */
  block: {
    blockId: string;
    type: BlockType;
    subtype: string | null;
    sectionPath: string[];
    pageRange: {
      start: number;
      end: number;
    };
    order: number;
    content: {
      text: string | null;
      markdown: string | null;
    };
    caption: string | null;
  };
  
  /** 上下文信息 */
  context: {
    beforeText: string | null;
    afterText: string | null;
    section: string;
    subsection: string | null;
  };
  
  /** 嵌入模型（可选） */
  embeddingModel?: string;
}

/**
 * Strategy for splitting blocks into chunks.
 * 
 * 中文：Block 到 Chunk 的分块策略，支持多种策略以适应不同内容类型。
 * English: Strategy for splitting blocks into chunks, supporting multiple strategies for different content types.
 */
export type ChunkStrategy = 
  | "paragraph"    // 每个段落一个 Chunk
  | "section"      // 每个章节一个 Chunk
  | "merged"       // 合并短 Block
  | "split"        // 拆分长 Block
  | "custom";      // 自定义策略

/**
 * Configuration for chunk creation.
 * 
 * 中文：Chunk 创建的配置参数，控制分块行为。
 * English: Configuration parameters for chunk creation, controlling chunking behavior.
 */
export interface ChunkConfig {
  /** 分块策略 */
  strategy: ChunkStrategy;
  
  /** 最大 Token 数（用于 split 策略） */
  maxTokens: number;
  
  /** 最小 Token 数（用于 merged 策略） */
  minTokens: number;
  
  /** 重叠 Token 数（用于上下文连续性） */
  overlapTokens: number;
  
  /** 是否保留原始格式 */
  preserveFormatting: boolean;
  
  /** 是否计算嵌入向量 */
  computeEmbeddings: boolean;
  
  /** 嵌入模型名称 */
  embeddingModel: string | null;
}

/**
 * Default chunk configuration.
 * 
 * 中文：默认的 Chunk 配置，适用于大多数学术论文。
 * English: Default chunk configuration, suitable for most academic papers.
 */
export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  strategy: "paragraph",
  maxTokens: 512,
  minTokens: 50,
  overlapTokens: 50,
  preserveFormatting: true,
  computeEmbeddings: true,
  embeddingModel: "bge-m3"
};

/**
 * Helper function to create a chunk ID.
 * 
 * 中文：创建 Chunk ID 的辅助函数，确保 ID 的唯一性和可读性。
 * English: Helper function to create a chunk ID, ensuring uniqueness and readability.
 */
export function makeChunkId(
  itemKey: string,
  blockId: string,
  chunkIndex: number
): string {
  return `${itemKey}_${blockId}_c${chunkIndex.toString().padStart(3, "0")}`;
}

/**
 * Estimate token count for text.
 * 
 * 中文：估算文本的 Token 数量，用于分块决策。这是一个简单的估算，
 * 实际 Token 数量取决于具体的分词器。
 * English: Estimate token count for text, used for chunking decisions. This is a simple estimation,
 * actual token count depends on the specific tokenizer.
 */
export function estimateTokenCount(text: string): number {
  // 简单估算：英文约 4 字符/token，中文约 2 字符/token
  // 这里使用保守估算：3 字符/token
  return Math.ceil(text.length / 3);
}

/**
 * Create a text hash for deduplication.
 * 
 * 中文：创建文本哈希用于去重，使用简单的 FNV-1a 哈希算法。
 * English: Create a text hash for deduplication using simple FNV-1a hash algorithm.
 */
export function createTextHash(text: string): string {
  let hash = 2166136261;
  
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  
  return Math.abs(hash >>> 0).toString(36);
}