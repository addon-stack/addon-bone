import {stripVTControlCharacters} from "node:util";

import type {Compiler, StatsError} from "@rspack/core";

import {createCompiler} from "@cli/builders/app";
import {watchOptions} from "@cli/builders/app/watch";
import configResolver from "@cli/resolvers/config";

import {
    BuildRunnerFatalCode,
    type BuildRunnerEvent,
    type BuildRunnerRequest,
    type BuildRunnerStartRequest,
} from "./protocol";

import {Command} from "@typing/app";

// The dev session's build process: one watching compiler, reported over IPC. It prints nothing itself.

const PluginName = "adnbn:build-runner";

/** Close budget when the parent is gone and cannot pass one. */
const CloseTimeout = 10_000;

let compiler: Compiler | undefined;
let started = false;
let closing = false;

const send = (event: BuildRunnerEvent): Promise<void> => {
    return new Promise(resolve => {
        if (!process.connected || !process.send) {
            resolve();

            return;
        }

        process.send(event, undefined, {}, () => resolve());
    });
};

/** Resolves with the reason the compiler did not close, or `undefined` once it closed. */
const closeCompiler = (timeout: number): Promise<Error | undefined> => {
    return new Promise(resolve => {
        const current = compiler;

        if (!current) {
            resolve(undefined);

            return;
        }

        const timer = setTimeout(() => {
            resolve(new Error(`Rspack compiler did not close within ${timeout} ms`));
        }, timeout);

        // Rspack closes the watcher, runs shutdown hooks and releases the native compiler.
        current.close(error => {
            clearTimeout(timer);
            resolve(error ?? undefined);
        });
    });
};

/** Sends the failure to the parent; once the parent is gone, stderr is the only place left for it. */
const report = async (code: BuildRunnerFatalCode, error: unknown): Promise<void> => {
    const message = error instanceof Error ? error.message : String(error);

    if (process.connected) {
        await send({type: "fatal", code, message});
    } else {
        console.error(`${code}: ${message}`);
    }
};

const close = async (timeout: number): Promise<void> => {
    if (closing) {
        return;
    }

    closing = true;

    const error = await closeCompiler(timeout);

    if (error) {
        await report(BuildRunnerFatalCode.CloseFailed, error);

        process.exit(1);
    }

    process.exit(0);
};

const fail = async (code: BuildRunnerFatalCode, error: unknown): Promise<void> => {
    if (closing) {
        return;
    }

    closing = true;

    await report(code, error);
    // The process already exits with a failure; a compiler that cannot close changes nothing for the parent.
    await closeCompiler(2_000);

    process.exit(1);
};

const format = (errors: StatsError[] = []): string[] => {
    return errors.map(({moduleName, message}) => {
        const text = stripVTControlCharacters(message);

        return moduleName ? `${moduleName}\n${text}` : text;
    });
};

const start = async ({options, buildId}: BuildRunnerStartRequest): Promise<void> => {
    let nextBuildId = buildId;
    let currentBuildId = buildId;

    try {
        const config = await configResolver({...options, command: Command.Dev});

        if (closing) {
            return;
        }

        compiler = await createCompiler(config);
    } catch (error) {
        await fail(BuildRunnerFatalCode.ConfigFailed, error);

        return;
    }

    compiler.hooks.watchRun.tap(PluginName, ({modifiedFiles, removedFiles}) => {
        currentBuildId = nextBuildId++;

        void send({
            type: "compile",
            buildId: currentBuildId,
            modifiedFiles: Array.from(modifiedFiles ?? []),
            removedFiles: Array.from(removedFiles ?? []),
        });
    });

    compiler.watch(watchOptions, (error, stats) => {
        if (error || !stats) {
            void fail(BuildRunnerFatalCode.BuildFatal, error ?? new Error("Rspack reported no compilation result"));

            return;
        }

        if (closing) {
            return;
        }

        const {errors, warnings} = stats.toJson({all: false, errors: true, warnings: true});

        void send({
            type: "done",
            buildId: currentBuildId,
            ok: !stats.hasErrors(),
            errors: format(errors),
            warnings: format(warnings),
        });
    });
};

// Installed before any long initialisation so a close request or a lost parent is handled during startup.
process.on("disconnect", () => {
    void close(CloseTimeout);
});

process.on("message", (request: BuildRunnerRequest) => {
    if (request.type === "close") {
        void close(request.timeout);

        return;
    }

    if (request.type === "start" && !started) {
        started = true;
        void start(request);
    }
});

process.on("uncaughtException", error => {
    void fail(BuildRunnerFatalCode.BuildFatal, error);
});

process.on("unhandledRejection", error => {
    void fail(BuildRunnerFatalCode.BuildFatal, error);
});

// The parent may already be gone while the compiler modules were loading.
if (!process.connected) {
    void close(CloseTimeout);
}
