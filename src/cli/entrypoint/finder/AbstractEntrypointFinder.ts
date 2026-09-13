import fs, {Dirent} from "fs";
import path from "path";
import pluralize from "pluralize";

import AbstractParsedFinder from "./AbstractParsedFinder";
import {FileLayer, setFilePrecedence} from "./utils/filePrecedence";

import {getAppSourcePath, getSharedPath} from "@cli/resolvers/path";

import {EntrypointFile, EntrypointFileExtensions, EntrypointOptions} from "@typing/entrypoint";
import {ReadonlyConfig} from "@typing/config";

export default abstract class<O extends EntrypointOptions> extends AbstractParsedFinder<O> {
    protected fileExtensionsPattern: string;

    protected possibleIndexFiles: Set<string>;

    protected constructor(config: ReadonlyConfig) {
        super(config);

        // prettier-ignore
        this.fileExtensionsPattern = [...EntrypointFileExtensions]
            .map(ext => ext.replace(".", "\\."))
            .join("|");

        // prettier-ignore
        this.possibleIndexFiles = new Set([...EntrypointFileExtensions]
            .map(ext => `index.${ext}`));
    }

    public canMerge(): boolean {
        return false;
    }

    protected async getFiles(): Promise<Set<EntrypointFile>> {
        const entrypoint = this.type();

        let files = new Set<EntrypointFile>();

        const appFiles = this.findFiles(getAppSourcePath(this.config));

        for (const file of appFiles) {
            setFilePrecedence(file, {layer: FileLayer.AppSource});
        }

        if (appFiles.size > 0) {
            files = appFiles;

            if (this.config.debug) {
                console.info(`App "${entrypoint}" files added:`, appFiles);
            }
        }

        if ((appFiles.size > 0 && this.canMerge()) || appFiles.size === 0) {
            const sharedFiles = this.findFiles(getSharedPath(this.config));

            for (const file of sharedFiles) {
                setFilePrecedence(file, {layer: FileLayer.Shared});
            }

            if (sharedFiles.size > 0) {
                files = new Set([...files, ...sharedFiles]);

                if (this.config.debug) {
                    console.info(`Shared "${entrypoint}" files added:`, sharedFiles);
                }
            }
        }

        return files;
    }

    protected findFiles(directory: string): Set<EntrypointFile> {
        const entrypoint = this.type();
        const entrypointPluralize = pluralize(entrypoint);

        const rootFiles: EntrypointFile[] = [];
        const groupedFiles: EntrypointFile[] = [];

        const collect = (dir: string, files: EntrypointFile[], collectGrouped: boolean): void => {
            let entries: Dirent[];

            try {
                entries = fs.readdirSync(dir, {withFileTypes: true});
            } catch (e) {
                if (this.config.debug) {
                    console.log(`Failed to read ${entrypoint} entrypoint directory: "${dir}". Skipping.`);
                }

                return;
            }

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    if (this.isValidDirname(entry.name)) {
                        for (const indexFile of this.possibleIndexFiles) {
                            const indexPath = path.join(fullPath, indexFile);

                            try {
                                const stat = fs.statSync(indexPath);

                                if (stat.isFile()) {
                                    files.push(this.file(indexPath));
                                }
                            } catch (e) {
                                if (this.config.debug) {
                                    console.log(
                                        `Error reading ${entrypoint} entrypoint index file: "${indexPath}". Skipping.`
                                    );
                                }
                            }
                        }
                    } else if (collectGrouped && entry.name === entrypointPluralize) {
                        collect(fullPath, groupedFiles, false);
                    }
                } else if (entry.isFile() && this.isValidFilename(entry.name)) {
                    files.push(this.file(fullPath));
                }
            }
        };

        collect(directory, rootFiles, true);

        if (groupedFiles.length > 0) {
            return new Set(groupedFiles);
        }

        if (rootFiles.length > 0) {
            return new Set(rootFiles);
        }

        try {
            directory = path.join(directory, entrypoint);

            const stat = fs.statSync(directory);

            if (stat.isDirectory()) {
                collect(directory, rootFiles, false);
            }
        } catch (e) {
            if (this.config.debug) {
                console.log("Error reading entrypoint directory:", directory);
            }
        }

        return new Set(rootFiles);
    }

    protected isValidFilename(filename: string): boolean {
        const name = this.type().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        const pattern = new RegExp(`^(?:.*\\.)?${name}\\.(${this.fileExtensionsPattern})$`);

        return pattern.test(filename);
    }

    protected isValidDirname(dirname: string): boolean {
        const entrypoint = this.type();

        return dirname === entrypoint || dirname.endsWith(`.${entrypoint}`);
    }
}
