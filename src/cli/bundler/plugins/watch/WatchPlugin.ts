import {Compiler} from "@rspack/core";
import {watchCompilation} from "../utils";

export type WatchPluginCallback = (files: ReadonlySet<string>) => Promise<void>;

export default class WatchPlugin {
    constructor(private readonly callback: WatchPluginCallback) {}

    public apply(compiler: Compiler): void {
        watchCompilation(compiler, "WatchPlugin", async () => {
            await this.callback(compiler.modifiedFiles ?? new Set());
        });
    }
}
