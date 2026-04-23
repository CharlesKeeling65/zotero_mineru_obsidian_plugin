import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface ParseCache {
  writeRawFile(name: string, content: string): Promise<void>;
}

export class FilesystemParseCache implements ParseCache {
  public constructor(private readonly rootDir: string) {}

  public async writeRawFile(name: string, content: string): Promise<void> {
    const targetPath = join(this.rootDir, name);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, "utf8");
  }
}
