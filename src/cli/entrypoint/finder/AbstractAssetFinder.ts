import path from "path";
import fs from "fs";

import {getAppPath, getAppSourcePath, getResolvePath, getSharedPath, getSourcePath} from "@cli/resolvers/path";

import AbstractFinder from "./AbstractFinder";
import {FileLayer, getWorkspaceFileLayers, setFilePrecedence, type WorkspaceFileLayer} from "./utils/filePrecedence";

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
        const files = new Map<string, EntrypointFile>();

        const collect = async (directory: string, layer: FileLayer): Promise<void> => {
            const assetFiles = await this.findFiles(getResolvePath(directory));

            for (const file of assetFiles) {
                const canonicalPath = fs.realpathSync.native(file.file);

                if (!files.has(canonicalPath)) {
                    files.set(canonicalPath, setFilePrecedence(file, {layer}));
                }
            }
        };

        const dir = this.getDirectory();

        const directories: Record<WorkspaceFileLayer, string> = {
            [FileLayer.Source]: getSourcePath(this.config, dir),
            [FileLayer.Shared]: getSharedPath(this.config, dir),
            [FileLayer.App]: getAppPath(this.config, dir),
            [FileLayer.AppSource]: getAppSourcePath(this.config, dir),
        };

        const merge = this.canMerge();

        for (const layer of getWorkspaceFileLayers()) {
            await collect(directories[layer], layer);

            if (!merge && files.size > 0) {
                break;
            }
        }

        return new Set(files.values());
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
