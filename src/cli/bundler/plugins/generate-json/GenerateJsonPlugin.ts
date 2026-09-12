import {Compilation, Compiler, sources} from "@rspack/core";
import path from "path";
import {promisify} from "util";
import {watchCompilation} from "../utils";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;

interface JsonObject {
    [key: string]: JsonValue;
}

type JsonArray = JsonValue[];

export type GenerateJsonPluginData = Record<string, JsonValue>;

export type GenerateJsonPluginUpdate = () => Promise<GenerateJsonPluginData>;

export default class GenerateJsonPlugin {
    private readonly pluginName: string = "GenerateJsonPlugin";

    private update?: GenerateJsonPluginUpdate;

    constructor(protected data: GenerateJsonPluginData) {}

    public apply(compiler: Compiler): void {
        let emitted = new Set<string>();

        watchCompilation(compiler, this.pluginName, async () => {
            const update = this.update;

            if (update) {
                this.data = await update();
            }
        });

        compiler.hooks.compilation.tap(this.pluginName, (compilation: Compilation) => {
            compilation.hooks.processAssets.tap(
                {
                    name: this.pluginName,
                    stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
                },
                () => this.generateFiles(compilation)
            );
        });

        compiler.hooks.afterEmit.tapPromise(this.pluginName, async compilation => {
            if (compilation.errors.length) return;

            const current = new Set(Object.keys(this.data));
            for (const filename of emitted) {
                if (!current.has(filename) && !compilation.getAsset(filename)) {
                    await this.removeFile(compiler, filename);
                }
            }
            emitted = current;
        });
    }

    public watch(update: GenerateJsonPluginUpdate): this {
        this.update = update;

        return this;
    }

    protected generateFiles(compilation: Compilation): void {
        Object.entries(this.data).forEach(([filename, jsonData]) => {
            const json = JSON.stringify(jsonData, null, 2);

            compilation.emitAsset(filename, new sources.RawSource(json));
        });
    }

    private async removeFile(compiler: Compiler, filename: string): Promise<void> {
        const filesystem = compiler.outputFileSystem!;
        const output = compiler.options.output.path!;
        const file = path.join(output, filename);
        await promisify(filesystem.unlink.bind(filesystem))(file).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== "ENOENT") throw error;
        });

        // Remove only empty parent directories owned by the removed output, stopping at output.path.
        for (
            let directory = path.dirname(file);
            directory.startsWith(output + path.sep);
            directory = path.dirname(directory)
        ) {
            const removed = await promisify(filesystem.rmdir.bind(filesystem))(directory).then(
                () => true,
                (error: NodeJS.ErrnoException) => {
                    if (error.code === "ENOENT") return true;
                    if (error.code === "ENOTEMPTY" || error.code === "EEXIST") return false;
                    throw error;
                }
            );
            if (!removed) break;
        }
    }
}
