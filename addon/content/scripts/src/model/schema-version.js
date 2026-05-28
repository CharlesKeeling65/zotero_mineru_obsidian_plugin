/**
 * Version of the internal normalized document schema.
 *
 * 中文：schema version 是长期维护必需品。只要 Document/Block/Asset/Relation 等
 * 持久化结构发生不兼容变化，就应该升级这里并提供迁移策略。
 *
 * English: schema versioning is required for durable stored data. Bump this
 * when persisted normalized entities change incompatibly and add migration logic.
 */
export const DOCUMENT_SCHEMA_VERSION = "2026-04-24";
