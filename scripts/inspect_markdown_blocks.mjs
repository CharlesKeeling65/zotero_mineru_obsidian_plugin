import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { markdownToTextBlocks } from "../dist/src/parse/markdown-preprocessor.js";

const markdownPath = process.argv[2];
const previewCount = Number(process.argv[3] ?? 8);

if (!markdownPath) {
  console.error("Usage: npm run inspect:markdown-blocks -- /absolute/path/to/paper.md [previewCount]");
  process.exit(1);
}

const markdown = await readFile(markdownPath, "utf8");
const blocks = markdownToTextBlocks(markdown);
const preview = blocks.slice(0, previewCount).map((block) => ({
  order: block.order,
  section: block.section,
  text: block.text
}));

console.log(
  JSON.stringify(
    {
      source: markdownPath,
      file: basename(markdownPath),
      blockCount: blocks.length,
      firstBlocks: preview,
      lastBlocks: blocks.slice(-3).map((block) => ({
        order: block.order,
        section: block.section,
        text: block.text
      }))
    },
    null,
    2
  )
);
