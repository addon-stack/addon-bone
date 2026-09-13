import type {Compiler} from "@rspack/core";

/** Report failed updates as compilation errors so watch stays connected for the next edit. */
export const watchCompilation = (compiler: Compiler, name: string, update: () => Promise<void>): void => {
    let failure: Error | undefined;

    compiler.hooks.watchRun.tapPromise(name, async () => {
        failure = undefined;

        try {
            await update();
        } catch (error) {
            failure = error instanceof Error ? error : new Error(String(error));
        }
    });

    compiler.hooks.thisCompilation.tap(name, compilation => {
        if (failure) compilation.errors.push(failure);
    });
};
