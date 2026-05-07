import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { MineruAgentProvider } from "../../src/mineru/provider-agent.js";

describe("MineruAgentProvider", () => {
  it("creates a MinerU file task, uploads the PDF, polls, and returns markdown raw output", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "mineru-agent-"));
    const pdfPath = join(tmp, "paper.pdf");
    await writeFile(pdfPath, "%PDF-1.7", "utf8");
    const calls: string[] = [];

    const provider = new MineruAgentProvider(
      {
        baseUrl: "https://mineru.net/api/v1/agent",
        timeoutMs: 1_000,
        pollIntervalMs: 0
      },
      {
        transport: {
          postJson: async <TResponse>(
            url: string,
            body: { file_name: string }
          ) => {
            calls.push(`POST ${url} ${body.file_name}`);
            return {
              code: 0,
              msg: "ok",
              data: {
                task_id: "task-1",
                file_url: "https://upload.example/paper.pdf"
              } as TResponse
            };
          },
          putBinary: async (url, body) => {
            calls.push(`PUT ${url} ${body.length}`);
          },
          getJson: async <TResponse>(url: string) => {
            calls.push(`GET_JSON ${url}`);
            return {
              code: 0,
              msg: "ok",
              data: {
                task_id: "task-1",
                state: "done",
                markdown_url: "https://cdn.example/paper.md"
              } as TResponse
            };
          },
          getText: async (url) => {
            calls.push(`GET_TEXT ${url}`);
            return "# Parsed Paper\n";
          }
        }
      }
    );

    const output = await provider.parsePdf({
      docId: "doc-1",
      zoteroItemKey: "ITEM1",
      pdfPath,
      title: "Paper"
    });

    expect(calls).toEqual([
      "POST https://mineru.net/api/v1/agent/parse/file paper.pdf",
      "PUT https://upload.example/paper.pdf 8",
      "GET_JSON https://mineru.net/api/v1/agent/parse/task-1",
      "GET_TEXT https://cdn.example/paper.md"
    ]);
    expect(output.document.markdown).toBe("# Parsed Paper\n");
    expect(output.rawFiles).toEqual([
      { name: "paper.md", content: "# Parsed Paper\n" },
      {
        name: "paper.mineru-task.json",
        content: JSON.stringify({ taskId: "task-1", markdownUrl: "https://cdn.example/paper.md" }, null, 2)
      }
    ]);
  });
});
