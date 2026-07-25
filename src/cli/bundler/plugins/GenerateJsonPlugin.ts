import {Compilation, Compiler, sources} from "@rspack/core";

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

    private error?: Error;

    constructor(protected data: GenerateJsonPluginData) {}

    public apply(compiler: Compiler): void {
        compiler.hooks.watchRun.tapPromise(this.pluginName, async () => {
            const update = this.update;

            if (!update) {
                return;
            }

            try {
                this.data = await update();
                this.error = undefined;
            } catch (e) {
                // Keep the last-known-good `this.data` and surface the error as a compilation error
                // (below) rather than crashing the dev server on a bad source edit.
                this.error = e instanceof Error ? e : new Error(String(e));
            }
        });

        compiler.hooks.compilation.tap(this.pluginName, (compilation: Compilation) => {
            if (this.error) {
                compilation.errors.push(this.error);
            }

            compilation.hooks.processAssets.tap(
                {
                    name: this.pluginName,
                    stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
                },
                () => this.generateFiles(compilation)
            );
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
}
