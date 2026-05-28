import { makeChunkId, estimateTokenCount, createTextHash, DEFAULT_CHUNK_CONFIG } from "../model/chunk.js";
export { DEFAULT_CHUNK_CONFIG } from "../model/chunk.js";
/**
 * Convert a block to one or more chunks based on configuration.
 *
 * 中文：将单个 Block 转换为一个或多个 Chunk。根据配置策略，
 * 可能会拆分长 Block 或合并短 Block。
 * English: Convert a single Block to one or more Chunks. Based on configuration strategy,
 * long Blocks may be split or short Blocks may be merged.
 */
export function convertBlockToChunks(input, config = DEFAULT_CHUNK_CONFIG) {
    const { block, context, itemKey, documentId, embeddingModel } = input;
    // 根据策略选择转换方法
    switch (config.strategy) {
        case "paragraph":
            return convertBlockToParagraphChunks(input, config);
        case "section":
            return convertBlockToSectionChunks(input, config);
        case "merged":
            return convertBlockToMergedChunks(input, config);
        case "split":
            return convertBlockToSplitChunks(input, config);
        default:
            return convertBlockToParagraphChunks(input, config);
    }
}
/**
 * Convert block to paragraph-level chunks (default strategy).
 *
 * 中文：将 Block 转换为段落级 Chunk，每个 Block 对应一个 Chunk。
 * 这是最简单的策略，适用于大多数学术论文。
 * English: Convert block to paragraph-level chunks, each Block corresponds to one Chunk.
 * This is the simplest strategy, suitable for most academic papers.
 */
function convertBlockToParagraphChunks(input, config) {
    const { block, context, itemKey, documentId, embeddingModel } = input;
    // 获取主要文本内容
    const text = block.content.text || block.content.markdown || block.caption || "";
    // 如果文本为空，跳过
    if (!text.trim()) {
        return [];
    }
    // 创建 Chunk
    const chunkId = makeChunkId(itemKey, block.blockId, 0);
    const tokenCount = estimateTokenCount(text);
    const chunk = {
        chunkId,
        itemKey,
        documentId,
        blockId: block.blockId,
        chunkLevel: "paragraph",
        text,
        contentMarkdown: block.content.markdown,
        context: {
            before: context.beforeText,
            after: context.afterText,
            section: context.section,
            subsection: context.subsection,
            sectionPath: block.sectionPath
        },
        metadata: {
            blockType: block.type,
            subtype: block.subtype,
            pageStart: block.pageRange.start,
            pageEnd: block.pageRange.end,
            order: block.order,
            tokenCount,
            textHash: createTextHash(text),
            createdAt: new Date().toISOString(),
            embeddingModel: embeddingModel || null,
            embedding: null
        },
        retrieval: {
            score: 0,
            bm25Score: null,
            vectorScore: null,
            rerankScore: null,
            retrievalSource: "hybrid",
            whyRelevant: null
        }
    };
    return [chunk];
}
/**
 * Convert block to section-level chunks.
 *
 * 中文：将 Block 转换为章节级 Chunk，同一章节的多个 Block 合并为一个 Chunk。
 * 适用于需要更大上下文的场景。
 * English: Convert block to section-level chunks, multiple Blocks in the same section
 * are merged into one Chunk. Suitable for scenarios requiring larger context.
 */
function convertBlockToSectionChunks(input, config) {
    // 对于 section 策略，我们需要在更高层级处理
    // 这里先返回段落级 Chunk，实际合并逻辑需要在批量处理中实现
    return convertBlockToParagraphChunks(input, config);
}
/**
 * Convert block to merged chunks.
 *
 * 中文：将 Block 转换为合并的 Chunk，短 Block 会被合并以达到最小 Token 数。
 * 适用于内容较短的学术论文。
 * English: Convert block to merged chunks, short Blocks are merged to reach minimum token count.
 * Suitable for academic papers with short content.
 */
function convertBlockToMergedChunks(input, config) {
    // 对于 merged 策略，我们需要在批量处理中实现
    // 这里先返回段落级 Chunk
    return convertBlockToParagraphChunks(input, config);
}
/**
 * Convert block to split chunks.
 *
 * 中文：将 Block 转换为拆分的 Chunk，长 Block 会被拆分为多个 Chunk。
 * 适用于内容较长的学术论文。
 * English: Convert block to split chunks, long Blocks are split into multiple Chunks.
 * Suitable for academic papers with long content.
 */
function convertBlockToSplitChunks(input, config) {
    const { block, context, itemKey, documentId, embeddingModel } = input;
    // 获取主要文本内容
    const text = block.content.text || block.content.markdown || block.caption || "";
    // 如果文本为空，跳过
    if (!text.trim()) {
        return [];
    }
    // 估算 Token 数量
    const totalTokens = estimateTokenCount(text);
    // 如果不超过最大 Token 数，返回单个 Chunk
    if (totalTokens <= config.maxTokens) {
        return convertBlockToParagraphChunks(input, config);
    }
    // 拆分文本
    const chunks = [];
    const sentences = splitTextIntoSentences(text);
    let currentText = "";
    let currentTokens = 0;
    let chunkIndex = 0;
    for (const sentence of sentences) {
        const sentenceTokens = estimateTokenCount(sentence);
        // 如果当前 Chunk 加上新句子会超过最大 Token 数
        if (currentTokens + sentenceTokens > config.maxTokens && currentText) {
            // 创建当前 Chunk
            const chunkId = makeChunkId(itemKey, block.blockId, chunkIndex);
            chunks.push({
                chunkId,
                itemKey,
                documentId,
                blockId: block.blockId,
                chunkLevel: "paragraph",
                text: currentText.trim(),
                contentMarkdown: currentText.trim(),
                context: {
                    before: context.beforeText,
                    after: context.afterText,
                    section: context.section,
                    subsection: context.subsection,
                    sectionPath: block.sectionPath
                },
                metadata: {
                    blockType: block.type,
                    subtype: block.subtype,
                    pageStart: block.pageRange.start,
                    pageEnd: block.pageRange.end,
                    order: block.order,
                    tokenCount: currentTokens,
                    textHash: createTextHash(currentText.trim()),
                    createdAt: new Date().toISOString(),
                    embeddingModel: embeddingModel || null,
                    embedding: null
                },
                retrieval: {
                    score: 0,
                    bm25Score: null,
                    vectorScore: null,
                    rerankScore: null,
                    retrievalSource: "hybrid",
                    whyRelevant: null
                }
            });
            // 重置当前 Chunk
            currentText = "";
            currentTokens = 0;
            chunkIndex++;
        }
        // 添加句子到当前 Chunk
        currentText += sentence;
        currentTokens += sentenceTokens;
    }
    // 处理最后一个 Chunk
    if (currentText.trim()) {
        const chunkId = makeChunkId(itemKey, block.blockId, chunkIndex);
        chunks.push({
            chunkId,
            itemKey,
            documentId,
            blockId: block.blockId,
            chunkLevel: "paragraph",
            text: currentText.trim(),
            contentMarkdown: currentText.trim(),
            context: {
                before: context.beforeText,
                after: context.afterText,
                section: context.section,
                subsection: context.subsection,
                sectionPath: block.sectionPath
            },
            metadata: {
                blockType: block.type,
                subtype: block.subtype,
                pageStart: block.pageRange.start,
                pageEnd: block.pageRange.end,
                order: block.order,
                tokenCount: currentTokens,
                textHash: createTextHash(currentText.trim()),
                createdAt: new Date().toISOString(),
                embeddingModel: embeddingModel || null,
                embedding: null
            },
            retrieval: {
                score: 0,
                bm25Score: null,
                vectorScore: null,
                rerankScore: null,
                retrievalSource: "hybrid",
                whyRelevant: null
            }
        });
    }
    return chunks;
}
/**
 * Split text into sentences.
 *
 * 中文：将文本拆分为句子，支持中英文标点符号。
 * English: Split text into sentences, supporting Chinese and English punctuation.
 */
function splitTextIntoSentences(text) {
    // 简单的句子拆分，支持中英文标点
    const sentenceRegex = /[^.!?\u3002\uff01\uff1f]+[.!?\u3002\uff01\uff1f]*/g;
    const matches = text.match(sentenceRegex);
    if (matches) {
        return matches.map(match => match.trim()).filter(match => match.length > 0);
    }
    // 如果没有找到句子，按换行符拆分
    return text.split(/\n+/).map(line => line.trim()).filter(line => line.length > 0);
}
/**
 * Convert multiple blocks to chunks.
 *
 * 中文：将多个 Block 转换为 Chunk，支持批量处理和合并策略。
 * English: Convert multiple blocks to chunks, supporting batch processing and merging strategies.
 */
export function convertBlocksToChunks(blocks, itemKey, documentId, config = DEFAULT_CHUNK_CONFIG, embeddingModel) {
    const allChunks = [];
    // 为每个 Block 创建上下文
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const prevBlock = i > 0 ? blocks[i - 1] : null;
        const nextBlock = i < blocks.length - 1 ? blocks[i + 1] : null;
        // 获取章节信息
        const section = block.sectionPath.length > 0 ? block.sectionPath[0] : "Unknown";
        const subsection = block.sectionPath.length > 1 ? block.sectionPath[1] : null;
        // 创建输入
        const input = {
            itemKey,
            documentId,
            block,
            context: {
                beforeText: prevBlock?.content.text || null,
                afterText: nextBlock?.content.text || null,
                section,
                subsection
            },
            embeddingModel
        };
        // 转换为 Chunk
        const chunks = convertBlockToChunks(input, config);
        allChunks.push(...chunks);
    }
    // 如果是 merged 策略，合并短 Chunk
    if (config.strategy === "merged") {
        return mergeShortChunks(allChunks, config);
    }
    return allChunks;
}
/**
 * Merge short chunks to reach minimum token count.
 *
 * 中文：合并短 Chunk 以达到最小 Token 数，提高检索效率。
 * English: Merge short chunks to reach minimum token count, improving retrieval efficiency.
 */
function mergeShortChunks(chunks, config) {
    if (chunks.length === 0) {
        return [];
    }
    const mergedChunks = [];
    let currentChunk = { ...chunks[0] };
    let currentTokens = currentChunk.metadata.tokenCount;
    for (let i = 1; i < chunks.length; i++) {
        const nextChunk = chunks[i];
        // 如果当前 Chunk 加上下一个 Chunk 会超过最大 Token 数
        if (currentTokens + nextChunk.metadata.tokenCount > config.maxTokens) {
            // 保存当前 Chunk
            mergedChunks.push(currentChunk);
            // 开始新的 Chunk
            currentChunk = { ...nextChunk };
            currentTokens = nextChunk.metadata.tokenCount;
        }
        else {
            // 合并 Chunk
            currentChunk.text += "\n\n" + nextChunk.text;
            if (currentChunk.contentMarkdown && nextChunk.contentMarkdown) {
                currentChunk.contentMarkdown += "\n\n" + nextChunk.contentMarkdown;
            }
            currentChunk.metadata.tokenCount += nextChunk.metadata.tokenCount;
            currentChunk.metadata.textHash = createTextHash(currentChunk.text);
            currentTokens += nextChunk.metadata.tokenCount;
        }
    }
    // 添加最后一个 Chunk
    mergedChunks.push(currentChunk);
    return mergedChunks;
}
