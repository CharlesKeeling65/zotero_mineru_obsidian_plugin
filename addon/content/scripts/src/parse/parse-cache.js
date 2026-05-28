import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
export class FilesystemParseCache {
    rootDir;
    constructor(rootDir) {
        this.rootDir = rootDir;
    }
    async writeRawFile(name, content) {
        const targetPath = join(this.rootDir, name);
        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, content, "utf8");
    }
}
