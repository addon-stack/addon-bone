import {Compiler} from "@rspack/core";

export type WatchPluginCallback = (files: ReadonlySet<string>) => Promise<void>;

export default class WatchPlugin {
    constructor(private readonly callback: WatchPluginCallback) {}

    public apply(compiler: Compiler): void {
        compiler.hooks.watchRun.tapAsync("WatchPlugin", async (compiler, callback) => {
            try {
                const {modifiedFiles = new Set()} = compiler;

                await this.callback(modifiedFiles);

                callback();
            } catch (e) {
                callback(e as Error);
            }
        });
    }
}
