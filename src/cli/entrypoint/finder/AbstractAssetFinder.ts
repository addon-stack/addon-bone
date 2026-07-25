import path from "path";
import fs from "fs";

import {getAppPath, getAppSourcePath, getResolvePath, getSharedPath, getSourcePath} from "@cli/resolvers/path";

import AbstractFinder from "./AbstractFinder";

import {EntrypointFile} from "@typing/entrypoint";

export default abstract class extends AbstractFinder {
    public abstract getNames(): ReadonlySet<string>;

    public abstract isValidExtension(extension: string): boolean;

    public getDirectory(): string {
        return ".";
    }

    public isValidName(name: string): boolean {
        return name.length > 0 && this.getNames().has(name);
    }

    public canMerge(): boolean {
        return false;
    }

    public isValidFilename(filename: string): boolean {
        let {name, ext} = path.parse(filename);

        if (ext.startsWith(".")) {
            ext = ext.slice(1);
        }

        return this.isValidName(name) && this.isValidExtension(ext);
    }

    protected async getFiles(): Promise<Set<EntrypointFile>> {
        const files = new Set<EntrypointFile>();

        const parser = async (directory: string): Promise<void> => {
            if (files.size === 0 || this.canMerge()) {
                const localeFiles = await this.findFiles(getResolvePath(directory));

                for (const file of localeFiles) {
                    files.add(file);
                }
            }
        };

        for (const directory of this.directories()) {
            await parser(directory);
        }

        return files;
    }

    /**
     * The candidate asset directories this finder scans, INDEPENDENT of whether any files exist in
     * them yet. Used to register watch-graph context dependencies (see {@link VirtualDataPlugin}) so
     * that creating the FIRST asset file — e.g. the first `locales/*.yaml` in a project that started
     * with none — is still detected and triggers a rebuild.
     */
    public directories(): string[] {
        const dir = this.getDirectory();

        return [
            getAppSourcePath(this.config, dir),
            getAppPath(this.config, dir),
            getSharedPath(this.config, dir),
            getSourcePath(this.config, dir),
        ].map(getResolvePath);
    }

    protected async findFiles(directory: string): Promise<Set<EntrypointFile>> {
        const files = new Set<EntrypointFile>();

        try {
            const entries = fs.readdirSync(directory);

            for (const entry of entries) {
                const fullPath = path.join(directory, entry);
                const stats = fs.statSync(fullPath);

                if (stats.isFile() && this.isValidFilename(fullPath)) {
                    files.add(this.file(fullPath));
                }
            }
        } catch {}

        return files;
    }
}
