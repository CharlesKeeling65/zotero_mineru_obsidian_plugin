import type { TranslatedTextBlock } from "../translate/contextual-translator.js";
import type { ZoteroTextLocation } from "./text-location.js";

export const GRAY_TRANSLATION_ANNOTATION_COLOR = "#aaaaaa";
const TRANSLATION_TAG = "mineru-translation";

export interface ZoteroAnnotationPosition {
  pageIndex: number;
  rects: number[][];
}

export interface ZoteroAnnotationTag {
  name: string;
}

export interface ZoteroTranslationAnnotationPayload {
  key: string;
  type: "highlight";
  text: string;
  comment: string;
  color: string;
  pageLabel: string;
  sortIndex: string;
  position: ZoteroAnnotationPosition;
  tags: ZoteroAnnotationTag[];
}

export interface ZoteroAnnotationsRuntime {
  Annotations: {
    saveFromJSON(
      attachment: unknown,
      annotation: ZoteroTranslationAnnotationPayload,
      options?: { skipSelect?: boolean }
    ): Promise<unknown>;
  };
}

export interface RuntimeZoteroAnnotationWriterInput {
  attachment: unknown;
  zotero: ZoteroAnnotationsRuntime;
}

export interface TranslationAnnotationWriter {
  createTranslationAnnotations(
    annotations: ZoteroTranslationAnnotationPayload[]
  ): Promise<number>;
}

export interface BuildTranslationAnnotationPayloadOptions {
  textLocations?: Map<string, ZoteroTextLocation>;
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function makeZoteroKey(value: string): string {
  return hashString(value).toString(36).toUpperCase().padStart(8, "0").slice(-8);
}

function padSortPart(value: number): string {
  return value.toString().padStart(5, "0");
}

function makeSortIndex(translation: TranslatedTextBlock): string {
  const pageIndex = Math.max(0, translation.pageRange.start - 1);
  return `${padSortPart(pageIndex)}|${translation.order.toString().padStart(6, "0")}|00000`;
}

export function buildTranslationAnnotationPayloads(
  translations: TranslatedTextBlock[],
  options: BuildTranslationAnnotationPayloadOptions = {}
): ZoteroTranslationAnnotationPayload[] {
  return translations.map((translation) => {
    const textLocation = options.textLocations?.get(translation.blockId);
    const pageIndex = textLocation?.pageIndex ?? Math.max(0, translation.pageRange.start - 1);
    const pageLabel = textLocation?.pageLabel ?? String(translation.pageRange.start);

    return {
      key: makeZoteroKey(`${translation.blockId}:${translation.sourceText}`),
      type: "highlight",
      text: translation.sourceText,
      comment: translation.translation,
      color: GRAY_TRANSLATION_ANNOTATION_COLOR,
      pageLabel,
      sortIndex: textLocation
        ? `${padSortPart(pageIndex)}|${translation.order.toString().padStart(6, "0")}|00000`
        : makeSortIndex(translation),
      position: {
        pageIndex,
        rects: textLocation?.rects ?? []
      },
      tags: [{ name: TRANSLATION_TAG }]
    };
  });
}

export class RuntimeZoteroAnnotationWriter implements TranslationAnnotationWriter {
  public constructor(private readonly input: RuntimeZoteroAnnotationWriterInput) {}

  public async createTranslationAnnotations(
    annotations: ZoteroTranslationAnnotationPayload[]
  ): Promise<number> {
    for (const annotation of annotations) {
      await this.input.zotero.Annotations.saveFromJSON(
        this.input.attachment,
        annotation,
        { skipSelect: true }
      );
    }

    return annotations.length;
  }
}
