import {rspack, Stats, type Compiler} from "@rspack/core";
import {mkdtemp, readFile, rm} from "fs/promises";
import os from "os";
import path from "path";

import {BuildError, build} from "./build";

const fixtures = path.join(__dirname, "tests", "fixtures");
let output: string;

beforeEach(async () => {
    output = await mkdtemp(path.join(os.tmpdir(), "adnbn-build-lifecycle-"));
});

afterEach(async () => {
    await rm(output, {recursive: true, force: true});
});

const createCompiler = (entry = "entry.js"): Compiler => {
    return rspack({
        mode: "development",
        context: fixtures,
        entry: path.join(fixtures, entry),
        output: {path: output, filename: "bundle.js"},
    });
};

// A deliberately failing shutdown hook prevents Rspack from reaching native cleanup.
// It fails once; a second close in these tests releases the real compiler after checking the error.
const closeCompiler = (compiler: Compiler): Promise<void> => {
    return new Promise((resolve, reject) => {
        compiler.close(error => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
};

test("returns the real Stats only after asynchronous compiler shutdown finishes", async () => {
    const compiler = createCompiler();
    const closing = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let compilation: Stats | undefined;
    let settled = false;
    let closes = 0;

    compiler.hooks.done.tap("CaptureStats", stats => {
        compilation = stats;
    });
    compiler.hooks.shutdown.tapPromise("HoldShutdown", async () => {
        closes++;
        closing.resolve();
        await release.promise;
    });

    const result = build(compiler).then(stats => {
        settled = true;

        return stats;
    });

    try {
        await closing.promise;
        expect(settled).toBe(false);
        expect(compilation?.hasErrors()).toBe(false);
    } finally {
        release.resolve();
    }

    expect(await result).toBe(compilation);
    expect(closes).toBe(1);
    expect(await readFile(path.join(output, "bundle.js"), "utf8")).toContain("buildLifecycleFixture");
});

test("closes a failed compilation and preserves its diagnostic Stats", async () => {
    const compiler = createCompiler("missing-import.js");
    const closing = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let settled = false;
    let closed = false;

    compiler.hooks.shutdown.tapPromise("ObserveShutdown", async () => {
        closing.resolve();
        await release.promise;
        closed = true;
    });

    const result = build(compiler).catch(error => {
        settled = true;

        return error;
    });

    try {
        await closing.promise;
        expect(settled).toBe(false);
    } finally {
        release.resolve();
    }

    const error = await result;

    expect(error).toBeInstanceOf(BuildError);
    expect(closed).toBe(true);
    expect(error.stats).toBeInstanceOf(Stats);
    expect(error.stats.hasErrors()).toBe(true);
    expect(error.stats.toString({all: false, errors: true})).toContain("not-present.js");
});

test("closes after a fatal plugin error and preserves the original cause", async () => {
    const compiler = createCompiler();
    const failure = new Error("beforeRun failed");
    let closed = false;

    compiler.hooks.beforeRun.tap("FailBuild", () => {
        throw failure;
    });
    compiler.hooks.shutdown.tap("ObserveShutdown", () => {
        closed = true;
    });

    await expect(build(compiler)).rejects.toMatchObject({name: "BuildError", cause: failure});
    expect(closed).toBe(true);
});

test("rejects a successful compilation when closing fails and retains Stats", async () => {
    const compiler = createCompiler();
    const failure = new Error("shutdown failed");
    let closes = 0;

    compiler.hooks.shutdown.tap("FailFirstClose", () => {
        if (++closes === 1) {
            throw failure;
        }
    });

    try {
        const error = await build(compiler).catch(error => error);

        expect(error).toBeInstanceOf(BuildError);
        expect(error.message).toBe("Rspack close error");
        expect(error.cause).toBe(failure);
        expect(error.stats.hasErrors()).toBe(false);
        expect(closes).toBe(1);
    } finally {
        await closeCompiler(compiler);
    }
});

test("preserves both failures when compilation and shutdown fail", async () => {
    const compiler = createCompiler();
    const compilationFailure = new Error("beforeRun failed");
    const closeFailure = new Error("shutdown failed");
    let closes = 0;

    compiler.hooks.beforeRun.tap("FailBuild", () => {
        throw compilationFailure;
    });
    compiler.hooks.shutdown.tap("FailFirstClose", () => {
        if (++closes === 1) {
            throw closeFailure;
        }
    });

    try {
        const error = await build(compiler).catch(error => error);

        expect(error).toBeInstanceOf(BuildError);
        expect(error.message).toBe("Rspack compilation and close failed");
        expect(error.cause).toBeInstanceOf(AggregateError);
        expect(error.cause.errors).toEqual([compilationFailure, closeFailure]);
        expect(closes).toBe(1);
    } finally {
        await closeCompiler(compiler);
    }
});
