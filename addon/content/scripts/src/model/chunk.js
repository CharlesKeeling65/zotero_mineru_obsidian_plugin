/**
 * Default chunk configuration.
 *
 * 中文：默认的 Chunk 配置，适用于大多数学术论文。
 * English: Default chunk configuration, suitable for most academic papers.
 */
export const DEFAULT_CHUNK_CONFIG = {
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
export function makeChunkId(itemKey, blockId, chunkIndex) {
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
export function estimateTokenCount(text) {
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
export function createTextHash(text) {
    let hash = 2166136261;
    for (const character of text) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0).toString(36);
}
