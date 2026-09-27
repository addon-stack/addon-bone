import type {Compiler, Stats} from "@rspack/core";

export class BuildError extends Error {
    constructor(
        message: string,
        public readonly stats: Stats | undefined,
        options?: ErrorOptions
    ) {
        super(message, options);
        this.name = "BuildError";
    }
}

/** Owns a one-shot compiler; settles only after its close callback, including failed builds. */
export const build = async (compiler: Compiler): Promise<Stats> => {
    let stats: Stats | undefined;
    let message = "Rspack compilation error";
    const failures: unknown[] = [];

    try {
        await new Promise<void>((resolve, reject) => {
            compiler.run((error, result) => {
                stats = result;

                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        if (!stats) {
            throw new Error("Rspack completed without compilation statistics");
        }

        if (stats.hasErrors()) {
            throw new Error("Rspack reported compilation errors");
        }
    } catch (error) {
        failures.push(error);
    }

    try {
        await new Promise<void>((resolve, reject) => {
            compiler.close(error => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    } catch (error) {
        message = failures.length ? "Rspack compilation and close failed" : "Rspack close error";
        failures.push(error);
    }

    if (failures.length) {
        throw new BuildError(message, stats, {
            cause: failures.length === 1 ? failures[0] : new AggregateError(failures, message),
        });
    }

    return stats!;
};
