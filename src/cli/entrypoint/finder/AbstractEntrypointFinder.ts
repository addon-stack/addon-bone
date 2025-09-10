import fs, {Dirent} from "fs";
import path from "path";
import pluralize from "pluralize";

import AbstractOptionsFinder from "./AbstractOptionsFinder";

import {getAppSourcePath, getSharedPath} from "@cli/resolvers/path";

import {EntrypointFile, EntrypointFileExtensions, EntrypointOptions} from "@typing/entrypoint";
import {ReadonlyConfig} from "@typing/config";

export default abstract class<O extends EntrypointOptions> extends AbstractOptionsFinder<O> {
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

        if (appFiles.size > 0) {
            files = appFiles;

            if (this.config.debug) {
                console.info(`App "${entrypoint}" files added:`, appFiles);
            }
        }

        if ((appFiles.size > 0 && this.canMerge()) || appFiles.size === 0) {
            const sharedFiles = this.findFiles(getSharedPath(this.config));

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

        const files: EntrypointFile[] = [];

        const finder = (dir: string): void => {
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
                    } else if (entry.name === entrypointPluralize) {
                        finder(fullPath);
                    }
                } else if (entry.isFile() && this.isValidFilename(entry.name)) {
                    files.push(this.file(fullPath));
                }
            }
        };

        finder(directory);

        if (files.length === 0) {
            try {
                directory = path.join(directory, entrypoint);

                const stat = fs.statSync(directory);

                if (stat.isDirectory()) {
                    finder(directory);
                }
            } catch (e) {
                if (this.config.debug) {
                    console.log("Error reading entrypoint directory:", directory);
                }
            }
        }

        return new Set(files);
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
