/**
 * 增强型 Chunk 转换器。
 *
 * 中文：利用 MinerU 高级 API 解析结果加速文本分块。
 * MinerU 精准解析 API 返回的结果包含更丰富的结构化信息，
 * 可以用于优化文本分块策略。
 *
 * English: Enhanced chunk converter that leverages MinerU advanced API
 * parsing results to accelerate text chunking. MinerU Standard API
 * returns richer structured information that can be used to optimize
 * text chunking strategies.
 */

import type { BlockType } from "../model/block.js";
import type { 
  Chunk, 
  CreateChunkInput, 
  ChunkConfig, 
  ChunkContext,
  ChunkMetadata,
  ChunkRetrievalInfo
} from "../model/chunk.js";
import { 
  makeChunkId, 
  estimateTokenCount, 
  createTextHash,
  DEFAULT_CHUNK_CONFIG 
} from "../model/chunk.js";

/** Block subset type from CreateChunkInput for internal method signatures. */
type BlockSubset = CreateChunkInput["block"];

/**
 * MinerU 高级解析结果接口。
 *
 * 中文：定义 MinerU 精准解析 API 返回的高级结构化信息。
 * English: Define advanced structured information returned by MinerU Standard API.
 */
export interface MineruAdvancedParseResult {
  /** 中文：段落边界信息；English: paragraph boundary information. */
  paragraphBoundaries: Array<{
    startOffset: number;
    endOffset: number;
    confidence: number;
  }>;
  /** 中文：表格位置信息；English: table position information. */
  tablePositions: Array<{
    startOffset: number;
    endOffset: number;
    rows: number;
    columns: number;
  }>;
  /** 中文：公式位置信息；English: formula position information. */
  formulaPositions: Array<{
    startOffset: number;
    endOffset: number;
    type: "inline" | "block";
  }>;
  /** 中文：图片位置信息；English: image position information. */
  imagePositions: Array<{
    startOffset: number;
    endOffset: number;
    caption?: string;
  }>;
  /** 中文：标题层级信息；English: heading hierarchy information. */
  headingHierarchy: Array<{
    level: number;
    text: string;
    startOffset: number;
  }>;
  /** 中文：文档结构信息；English: document structure information. */
  documentStructure: {
    sections: Array<{
      title: string;
      level: number;
      startOffset: number;
      endOffset: number;
    }>;
    totalPages: number;
    language: string;
  };
}

/**
 * 增强型 Chunk 配置。
 *
 * 中文：扩展标准 Chunk 配置，添加高级 API 特有的选项。
 * English: Extend standard Chunk config with options specific to advanced API.
 */
export interface EnhancedChunkConfig extends ChunkConfig {
  /** 中文：是否使用段落边界信息；English: whether to use paragraph boundary information. */
  useParagraphBoundaries: boolean;
  /** 中文：是否使用表格位置信息；English: whether to use table position information. */
  useTablePositions: boolean;
  /**中文：是否使用公式位置信息；English: whether to use formula position information. */
  useFormulaPositions: boolean;
  /** 中文：是否使用图片位置信息；English: whether to use image position information. */
  useImagePositions: boolean;
  /** 中文：是否使用标题层级信息；English: whether to use heading hierarchy information. */
  useHeadingHierarchy: boolean;
  /** 中文：是否使用文档结构信息；English: whether to use document structure information. */
  useDocumentStructure: boolean;
}

/**
 * 默认增强型 Chunk 配置。
 *
 * 中文：默认启用所有高级功能。
 * English: Default configuration enabling all advanced features.
 */
export const DEFAULT_ENHANCED_CHUNK_CONFIG: EnhancedChunkConfig = {
  ...DEFAULT_CHUNK_CONFIG,
  useParagraphBoundaries: true,
  useTablePositions: true,
  useFormulaPositions: true,
  useImagePositions: true,
  useHeadingHierarchy: true,
  useDocumentStructure: true
};

/**
 * 增强型 Chunk 转换器。
 *
 * 中文：利用 MinerU 高级 API 解析结果进行智能分块。
 * English: Intelligent chunking using MinerU advanced API parsing results.
 */
export class EnhancedChunkConverter {
  private readonly config: EnhancedChunkConfig;
  private readonly advancedResult?: MineruAdvancedParseResult;

  constructor(
    config: EnhancedChunkConfig = DEFAULT_ENHANCED_CHUNK_CONFIG,
    advancedResult?: MineruAdvancedParseResult
  ) {
    this.config = config;
    this.advancedResult = advancedResult;
  }

  /**
   * 将 Block 转换为 Chunk，利用高级 API 结果优化分块。
   *
   * 中文：将 Block 转换为 Chunk，利用高级 API 结果进行智能分块。
   * English: Convert Block to Chunk with intelligent chunking using advanced API results.
   *
   * @param input 创建 Chunk 的输入 / Input for creating Chunk
   * @returns Chunk 数组 / Array of Chunks
   */
  convertBlockToChunks(input: CreateChunkInput): Chunk[] {
    const { block, context, itemKey, documentId, embeddingModel } = input;

    // 中文：如果没有高级 API 结果，使用标准转换器
    // English: If no advanced API results, use standard converter
    if (!this.advancedResult) {
      return this.convertBlockToStandardChunks(input);
    }

    // 中文：根据 Block 类型选择优化策略
    // English: Choose optimization strategy based on Block type
    switch (block.type) {
      case "text":
        return this.convertTextBlockWithAdvancedInfo(input);
      case "table":
        return this.convertTableBlockWithAdvancedInfo(input);
      case "formula":
        return this.convertFormulaBlockWithAdvancedInfo(input);
      case "figure":
        return this.convertFigureBlockWithAdvancedInfo(input);
      default:
        return this.convertBlockToStandardChunks(input);
    }
  }

  /**
   * 使用高级信息转换文本 Block。
   *
   * 中文：利用段落边界和标题层级信息优化文本分块。
   * English: Optimize text chunking using paragraph boundaries and heading hierarchy.
   *
   * @param input 创建 Chunk 的输入 / Input for creating Chunk
   * @returns Chunk 数组 / Array of Chunks
   */
  private convertTextBlockWithAdvancedInfo(input: CreateChunkInput): Chunk[] {
    const { block, context, itemKey, documentId, embeddingModel } = input;
    const text = block.content.text || "";
    
    // 中文：如果文本为空，返回空数组
    // English: If text is empty, return empty array
    if (!text.trim()) {
      return [];
    }

    // 中文：查找对应的段落边界信息
    // English: Find corresponding paragraph boundary information
    const paragraphBoundary = this.findParagraphBoundary(block);
    
    // 中文：如果找到段落边界，使用边界信息进行分块
    // English: If paragraph boundary found, use boundary information for chunking
    if (paragraphBoundary && this.config.useParagraphBoundaries) {
      return this.createChunksFromParagraphBoundary(input, paragraphBoundary);
    }

    // 中文：如果找到标题层级信息，使用标题信息进行分块
    // English: If heading hierarchy found, use heading information for chunking
    const headingInfo = this.findHeadingInfo(block);
    if (headingInfo && this.config.useHeadingHierarchy) {
      return this.createChunksFromHeadingInfo(input, headingInfo);
    }

    // 中文：否则使用标准分块策略
    // English: Otherwise use standard chunking strategy
    return this.convertBlockToStandardChunks(input);
  }

  /**
   * 使用高级信息转换表格 Block。
   *
   * 中文：利用表格位置信息优化表格分块。
   * English: Optimize table chunking using table position information.
   *
   * @param input 创建 Chunk 的输入 / Input for creating Chunk
   * @returns Chunk 数组 / Array of Chunks
   */
  private convertTableBlockWithAdvancedInfo(input: CreateChunkInput): Chunk[] {
    const { block, context, itemKey, documentId, embeddingModel } = input;
    
    // 中文：查找对应的表格位置信息
    // English: Find corresponding table position information
    const tablePosition = this.findTablePosition(block);
    
    // 中文：如果找到表格位置信息，使用位置信息进行分块
    // English: If table position found, use position information for chunking
    if (tablePosition && this.config.useTablePositions) {
      return this.createChunksFromTablePosition(input, tablePosition);
    }

    // 中文：否则使用标准分块策略
    // English: Otherwise use standard chunking strategy
    return this.convertBlockToStandardChunks(input);
  }

  /**
   * 使用高级信息转换公式 Block。
   *
   * 中文：利用公式位置信息优化公式分块。
   * English: Optimize formula chunking using formula position information.
   *
   * @param input 创建 Chunk 的输入 / Input for creating Chunk
   * @returns Chunk 数组 / Array of Chunks
   */
  private convertFormulaBlockWithAdvancedInfo(input: CreateChunkInput): Chunk[] {
    const { block, context, itemKey, documentId, embeddingModel } = input;
    
    // 中文：查找对应的公式位置信息
    // English: Find corresponding formula position information
    const formulaPosition = this.findFormulaPosition(block);
    
    // 中文：如果找到公式位置信息，使用位置信息进行分块
    // English: If formula position found, use position information for chunking
    if (formulaPosition && this.config.useFormulaPositions) {
      return this.createChunksFromFormulaPosition(input, formulaPosition);
    }

    // 中文：否则使用标准分块策略
    // English: Otherwise use standard chunking strategy
    return this.convertBlockToStandardChunks(input);
  }

  /**
   * 使用高级信息转换图片 Block。
   *
   * 中文：利用图片位置信息优化图片分块。
   * English: Optimize figure chunking using image position information.
   *
   * @param input 创建 Chunk 的输入 / Input for creating Chunk
   * @returns Chunk 数组 / Array of Chunks
   */
  private convertFigureBlockWithAdvancedInfo(input: CreateChunkInput): Chunk[] {
    const { block, context, itemKey, documentId, embeddingModel } = input;
    
    // 中文：查找对应的图片位置信息
    // English: Find corresponding image position information
    const imagePosition = this.findImagePosition(block);
    
    // 中文：如果找到图片位置信息，使用位置信息进行分块
    // English: If image position found, use position information for chunking
    if (imagePosition && this.config.useImagePositions) {
      return this.createChunksFromImagePosition(input, imagePosition);
    }

    // 中文：否则使用标准分块策略
    // English: Otherwise use standard chunking strategy
    return this.convertBlockToStandardChunks(input);
  }

  /**
   * 标准分块策略。
   *
   * 中文：使用标准分块策略，不依赖高级 API 结果。
   * English: Use standard chunking strategy without relying on advanced API results.
   *
   * @param input 创建 Chunk 的输入 / Input for creating Chunk
   * @returns Chunk 数组 / Array of Chunks
   */
  private convertBlockToStandardChunks(input: CreateChunkInput): Chunk[] {
    const { block, context, itemKey, documentId, embeddingModel } = input;
    const text = block.content.text || "";
    
    // 中文：如果文本为空，返回空数组
    // English: If text is empty, return empty array
    if (!text.trim()) {
      return [];
    }

    // 中文：创建单个 Chunk
    // English: Create single Chunk
    const chunk: Chunk = {
      chunkId: makeChunkId(itemKey, block.blockId, 0),
      itemKey,
      documentId,
      blockId: block.blockId,
      chunkLevel: "paragraph",
      text: text.trim(),
      contentMarkdown: block.content.markdown || null,
      context: {
        before: context.beforeText ?? null,
        after: context.afterText ?? null,
        section: context.section ?? "",
        subsection: context.subsection ?? null,
        sectionPath: block.sectionPath,
      },
      metadata: {
        blockType: block.type,
        subtype: block.subtype ?? null,
        pageStart: block.pageRange.start,
        pageEnd: block.pageRange.end,
        order: block.order,
        tokenCount: estimateTokenCount(text),
        textHash: createTextHash(text),
        createdAt: new Date().toISOString(),
        embeddingModel: embeddingModel ?? null,
        embedding: null,
      },
      retrieval: {
        score: 0,
        bm25Score: null,
        vectorScore: null,
        rerankScore: null,
        retrievalSource: "bm25",
        whyRelevant: null,
      }
    };

    return [chunk];
  }

  /**
   * 查找段落边界信息。
   *
   * 中文：在高级 API 结果中查找对应的段落边界信息。
   * English: Find corresponding paragraph boundary information in advanced API results.
   *
   * @param block Block 对象 / Block object
   * @returns 段落边界信息或 null / Paragraph boundary information or null
   */
  private findParagraphBoundary(block: BlockSubset): {
    startOffset: number;
    endOffset: number;
    confidence: number;
  } | null {
    if (!this.advancedResult?.paragraphBoundaries) {
      return null;
    }

    // 中文：这里需要根据 Block 的位置信息查找对应的段落边界
    // English: Here we need to find corresponding paragraph boundary based on Block position
    // 简化实现：返回第一个段落边界
    // Simplified implementation: return first paragraph boundary
    return this.advancedResult.paragraphBoundaries[0] || null;
  }

  /**
   * 查找标题层级信息。
   *
   * 中文：在高级 API 结果中查找对应的标题层级信息。
   * English: Find corresponding heading hierarchy information in advanced API results.
   *
   * @param block Block 对象 / Block object
   * @returns 标题层级信息或 null / Heading hierarchy information or null
   */
  private findHeadingInfo(block: BlockSubset): {
    level: number;
    text: string;
    startOffset: number;
  } | null {
    if (!this.advancedResult?.headingHierarchy) {
      return null;
    }

    // 中文：这里需要根据 Block 的位置信息查找对应的标题层级
    // English: Here we need to find corresponding heading hierarchy based on Block position
    // 简化实现：返回第一个标题层级
    // Simplified implementation: return first heading hierarchy
    return this.advancedResult.headingHierarchy[0] || null;
  }

  /**
   * 查找表格位置信息。
   *
   * 中文：在高级 API 结果中查找对应的表格位置信息。
   * English: Find corresponding table position information in advanced API results.
   *
   * @param block Block 对象 / Block object
   * @returns 表格位置信息或 null / Table position information or null
   */
  private findTablePosition(block: BlockSubset): {
    startOffset: number;
    endOffset: number;
    rows: number;
    columns: number;
  } | null {
    if (!this.advancedResult?.tablePositions) {
      return null;
    }

    // 中文：这里需要根据 Block 的位置信息查找对应的表格位置
    // English: Here we need to find corresponding table position based on Block position
    // 简化实现：返回第一个表格位置
    // Simplified implementation: return first table position
    return this.advancedResult.tablePositions[0] || null;
  }

  /**
   * 查找公式位置信息。
   *
   * 中文：在高级 API 结果中查找对应的公式位置信息。
   * English: Find corresponding formula position information in advanced API results.
   *
   * @param block Block 对象 / Block object
   * @returns 公式位置信息或 null / Formula position information or null
   */
  private findFormulaPosition(block: BlockSubset): {
    startOffset: number;
    endOffset: number;
    type: "inline" | "block";
  } | null {
    if (!this.advancedResult?.formulaPositions) {
      return null;
    }

    // 中文：这里需要根据 Block 的位置信息查找对应的公式位置
    // English: Here we need to find corresponding formula position based on Block position
    // 简化实现：返回第一个公式位置
    // Simplified implementation: return first formula position
    return this.advancedResult.formulaPositions[0] || null;
  }

  /**
   * 查找图片位置信息。
   *
   * 中文：在高级 API 结果中查找对应的图片位置信息。
   * English: Find corresponding image position information in advanced API results.
   *
   * @param block Block 对象 / Block object
   * @returns 图片位置信息或 null / Image position information or null
   */
  private findImagePosition(block: BlockSubset): {
    startOffset: number;
    endOffset: number;
    caption?: string;
  } | null {
    if (!this.advancedResult?.imagePositions) {
      return null;
    }

    // 中文：这里需要根据 Block 的位置信息查找对应的图片位置
    // English: Here we need to find corresponding image position based on Block position
    // 简化实现：返回第一个图片位置
    // Simplified implementation: return first image position
    return this.advancedResult.imagePositions[0] || null;
  }

  /**
   * 从段落边界创建 Chunk。
   *
   * 中文：根据段落边界信息创建 Chunk。
   * English: Create Chunk based on paragraph boundary information.
   *
   * @param input 创建 Chunk 的输入 / Input for creating Chunk
   * @param paragraphBoundary 段落边界信息 / Paragraph boundary information
   * @returns Chunk 数组 / Array of Chunks
   */
  private createChunksFromParagraphBoundary(
    input: CreateChunkInput,
    paragraphBoundary: {
      startOffset: number;
      endOffset: number;
      confidence: number;
    }
  ): Chunk[] {
    const { block, context, itemKey, documentId, embeddingModel } = input;
    const text = block.content.text || "";
    
    // 中文：根据段落边界提取文本
    // English: Extract text based on paragraph boundary
    const startOffset = Math.max(0, paragraphBoundary.startOffset);
    const endOffset = Math.min(text.length, paragraphBoundary.endOffset);
    const chunkText = text.substring(startOffset, endOffset).trim();
    
    // 中文：如果提取的文本为空，返回空数组
    // English: If extracted text is empty, return empty array
    if (!chunkText) {
      return [];
    }

    // 中文：创建 Chunk
    // English: Create Chunk
    const chunk: Chunk = {
      chunkId: makeChunkId(itemKey, block.blockId, 0),
      itemKey,
      documentId,
      blockId: block.blockId,
      chunkLevel: "paragraph",
      text: chunkText,
      contentMarkdown: block.content.markdown || null,
      context: {
        before: context.beforeText ?? null,
        after: context.afterText ?? null,
        section: context.section ?? "",
        subsection: context.subsection ?? null,
        sectionPath: block.sectionPath,
      },
      metadata: {
        blockType: block.type,
        subtype: block.subtype ?? null,
        pageStart: block.pageRange.start,
        pageEnd: block.pageRange.end,
        order: block.order,
        tokenCount: estimateTokenCount(chunkText),
        textHash: createTextHash(chunkText),
        createdAt: new Date().toISOString(),
        embeddingModel: embeddingModel ?? null,
        embedding: null,
      },
      retrieval: {
        score: paragraphBoundary.confidence,
        bm25Score: null,
        vectorScore: null,
        rerankScore: null,
        retrievalSource: "bm25",
        whyRelevant: null,
      }
    };

    return [chunk];
  }

  /**
   * 从标题层级创建 Chunk。
   *
   * 中文：根据标题层级信息创建 Chunk。
   * English: Create Chunk based on heading hierarchy information.
   *
   * @param input 创建 Chunk 的输入 / Input for creating Chunk
   * @param headingInfo 标题层级信息 / Heading hierarchy information
   * @returns Chunk 数组 / Array of Chunks
   */
  private createChunksFromHeadingInfo(
    input: CreateChunkInput,
    headingInfo: {
      level: number;
      text: string;
      startOffset: number;
    }
  ): Chunk[] {
    const { block, context, itemKey, documentId, embeddingModel } = input;
    const text = block.content.text || "";
    
    // 中文：根据标题层级提取文本
    // English: Extract text based on heading hierarchy
    const startOffset = Math.max(0, headingInfo.startOffset);
    const chunkText = text.substring(startOffset).trim();
    
    // 中文：如果提取的文本为空，返回空数组
    // English: If extracted text is empty, return empty array
    if (!chunkText) {
      return [];
    }

    // 中文：创建 Chunk
    // English: Create Chunk
    const chunk: Chunk = {
      chunkId: makeChunkId(itemKey, block.blockId, 0),
      itemKey,
      documentId,
      blockId: block.blockId,
      chunkLevel: "section",
      text: chunkText,
      contentMarkdown: block.content.markdown || null,
      context: {
        before: context.beforeText ?? null,
        after: context.afterText ?? null,
        section: headingInfo.text,
        subsection: null,
        sectionPath: [...block.sectionPath, headingInfo.text],
      },
      metadata: {
        blockType: block.type,
        subtype: block.subtype ?? null,
        pageStart: block.pageRange.start,
        pageEnd: block.pageRange.end,
        order: block.order,
        tokenCount: estimateTokenCount(chunkText),
        textHash: createTextHash(chunkText),
        createdAt: new Date().toISOString(),
        embeddingModel: embeddingModel ?? null,
        embedding: null,
      },
      retrieval: {
        score: 0,
        bm25Score: null,
        vectorScore: null,
        rerankScore: null,
        retrievalSource: "bm25",
        whyRelevant: null,
      }
    };

    return [chunk];
  }

  /**
   * 从表格位置创建 Chunk。
   *
   * 中文：根据表格位置信息创建 Chunk。
   * English: Create Chunk based on table position information.
   *
   * @param input 创建 Chunk 的输入 / Input for creating Chunk
   * @param tablePosition 表格位置信息 / Table position information
   * @returns Chunk 数组 / Array of Chunks
   */
  private createChunksFromTablePosition(
    input: CreateChunkInput,
    tablePosition: {
      startOffset: number;
      endOffset: number;
      rows: number;
      columns: number;
    }
  ): Chunk[] {
    const { block, context, itemKey, documentId, embeddingModel } = input;
    const text = block.content.text || "";
    
    // 中文：根据表格位置提取文本
    // English: Extract text based on table position
    const startOffset = Math.max(0, tablePosition.startOffset);
    const endOffset = Math.min(text.length, tablePosition.endOffset);
    const chunkText = text.substring(startOffset, endOffset).trim();
    
    // 中文：如果提取的文本为空，返回空数组
    // English: If extracted text is empty, return empty array
    if (!chunkText) {
      return [];
    }

    // 中文：创建 Chunk
    // English: Create Chunk
    const chunk: Chunk = {
      chunkId: makeChunkId(itemKey, block.blockId, 0),
      itemKey,
      documentId,
      blockId: block.blockId,
      chunkLevel: "paragraph",
      text: chunkText,
      contentMarkdown: block.content.markdown || null,
      context: {
        before: context.beforeText ?? null,
        after: context.afterText ?? null,
        section: context.section ?? "",
        subsection: context.subsection ?? null,
        sectionPath: block.sectionPath,
      },
      metadata: {
        blockType: block.type,
        subtype: block.subtype ?? null,
        pageStart: block.pageRange.start,
        pageEnd: block.pageRange.end,
        order: block.order,
        tokenCount: estimateTokenCount(chunkText),
        textHash: createTextHash(chunkText),
        createdAt: new Date().toISOString(),
        embeddingModel: embeddingModel ?? null,
        embedding: null,
      },
      retrieval: {
        score: 0,
        bm25Score: null,
        vectorScore: null,
        rerankScore: null,
        retrievalSource: "bm25",
        whyRelevant: null,
      }
    };

    return [chunk];
  }

  /**
   * 从公式位置创建 Chunk。
   *
   * 中文：根据公式位置信息创建 Chunk。
   * English: Create Chunk based on formula position information.
   *
   * @param input 创建 Chunk 的输入 / Input for creating Chunk
   * @param formulaPosition 公式位置信息 / Formula position information
   * @returns Chunk 数组 / Array of Chunks
   */
  private createChunksFromFormulaPosition(
    input: CreateChunkInput,
    formulaPosition: {
      startOffset: number;
      endOffset: number;
      type: "inline" | "block";
    }
  ): Chunk[] {
    const { block, context, itemKey, documentId, embeddingModel } = input;
    const text = block.content.text || "";
    
    // 中文：根据公式位置提取文本
    // English: Extract text based on formula position
    const startOffset = Math.max(0, formulaPosition.startOffset);
    const endOffset = Math.min(text.length, formulaPosition.endOffset);
    const chunkText = text.substring(startOffset, endOffset).trim();
    
    // 中文：如果提取的文本为空，返回空数组
    // English: If extracted text is empty, return empty array
    if (!chunkText) {
      return [];
    }

    // 中文：创建 Chunk
    // English: Create Chunk
    const chunk: Chunk = {
      chunkId: makeChunkId(itemKey, block.blockId, 0),
      itemKey,
      documentId,
      blockId: block.blockId,
      chunkLevel: "paragraph",
      text: chunkText,
      contentMarkdown: block.content.markdown || null,
      context: {
        before: context.beforeText ?? null,
        after: context.afterText ?? null,
        section: context.section ?? "",
        subsection: context.subsection ?? null,
        sectionPath: block.sectionPath,
      },
      metadata: {
        blockType: block.type,
        subtype: block.subtype ?? null,
        pageStart: block.pageRange.start,
        pageEnd: block.pageRange.end,
        order: block.order,
        tokenCount: estimateTokenCount(chunkText),
        textHash: createTextHash(chunkText),
        createdAt: new Date().toISOString(),
        embeddingModel: embeddingModel ?? null,
        embedding: null,
      },
      retrieval: {
        score: 0,
        bm25Score: null,
        vectorScore: null,
        rerankScore: null,
        retrievalSource: "bm25",
        whyRelevant: null,
      }
    };

    return [chunk];
  }

  /**
   * 从图片位置创建 Chunk。
   *
   * 中文：根据图片位置信息创建 Chunk。
   * English: Create Chunk based on image position information.
   *
   * @param input 创建 Chunk 的输入 / Input for creating Chunk
   * @param imagePosition 图片位置信息 / Image position information
   * @returns Chunk 数组 / Array of Chunks
   */
  private createChunksFromImagePosition(
    input: CreateChunkInput,
    imagePosition: {
      startOffset: number;
      endOffset: number;
      caption?: string;
    }
  ): Chunk[] {
    const { block, context, itemKey, documentId, embeddingModel } = input;
    const text = block.content.text || "";
    
    // 中文：根据图片位置提取文本
    // English: Extract text based on image position
    const startOffset = Math.max(0, imagePosition.startOffset);
    const endOffset = Math.min(text.length, imagePosition.endOffset);
    const chunkText = text.substring(startOffset, endOffset).trim();
    
    // 中文：如果提取的文本为空，返回空数组
    // English: If extracted text is empty, return empty array
    if (!chunkText) {
      return [];
    }

    // 中文：创建 Chunk
    // English: Create Chunk
    const chunk: Chunk = {
      chunkId: makeChunkId(itemKey, block.blockId, 0),
      itemKey,
      documentId,
      blockId: block.blockId,
      chunkLevel: "paragraph",
      text: chunkText,
      contentMarkdown: block.content.markdown || null,
      context: {
        before: context.beforeText ?? null,
        after: context.afterText ?? null,
        section: context.section ?? "",
        subsection: context.subsection ?? null,
        sectionPath: block.sectionPath,
      },
      metadata: {
        blockType: block.type,
        subtype: block.subtype ?? null,
        pageStart: block.pageRange.start,
        pageEnd: block.pageRange.end,
        order: block.order,
        tokenCount: estimateTokenCount(chunkText),
        textHash: createTextHash(chunkText),
        createdAt: new Date().toISOString(),
        embeddingModel: embeddingModel ?? null,
        embedding: null,
      },
      retrieval: {
        score: 0,
        bm25Score: null,
        vectorScore: null,
        rerankScore: null,
        retrievalSource: "bm25",
        whyRelevant: null,
      }
    };

    return [chunk];
  }

}

/**
 * 创建增强型 Chunk 转换器。
 *
 * 中文：创建增强型 Chunk 转换器实例。
 * English: Create enhanced chunk converter instance.
 *
 * @param config 配置 / Configuration
 * @param advancedResult 高级 API 结果 / Advanced API results
 * @returns 增强型 Chunk 转换器实例 / Enhanced chunk converter instance
 */
export function createEnhancedChunkConverter(
  config: EnhancedChunkConfig = DEFAULT_ENHANCED_CHUNK_CONFIG,
  advancedResult?: MineruAdvancedParseResult
): EnhancedChunkConverter {
  return new EnhancedChunkConverter(config, advancedResult);
}