import type { Asset, Block, Document, Relation } from "../model/index.js";
import { DOCUMENT_SCHEMA_VERSION } from "../model/index.js";
import type { RawMineruBlock, RawMineruDocument } from "../types/mineru.js";

export interface NormalizedDocument {
  document: Document;
  blocks: Block[];
  assets: Asset[];
  relations: Relation[];
}

function toSlugPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

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

function hashString(value: string): string {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0).toString(36);
}

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

export function normalizeMineruDocument(
  raw: RawMineruDocument,
  parseBackend = "agent"
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
        assetCount: 0,
        relationCount: relations.length
      },
      status: "parsed"
    },
    blocks,
    assets: [],
    relations
  };
}
