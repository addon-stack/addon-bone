import {mkdir, readFile, rm, unlink, writeFile} from "fs/promises";
import path from "path";
import postcss, {type Declaration} from "postcss";
import type {Compilation, Compiler, Stats} from "@rspack/core";

import {closeCompiler, createCompiler, createFixture, entries, fixtures, getCss} from "./compiler";
import {getBadgeClass} from "./style-output";

let root: string;
let compiler: Compiler | undefined;

beforeEach(async () => {
    root = await createFixture("bare-module-watch");
});

afterEach(async () => {
    try {
        if (compiler) {
            await closeCompiler(compiler);
        }
    } finally {
        compiler = undefined;
        await rm(root, {recursive: true, force: true});
    }
});

const colors = (compilation: Compilation, entry: string): string[] => {
    return postcss
        .parse(getCss(compilation, entry))
        .nodes.filter(node => node.type === "rule")
        .map(
            rule => rule.nodes.find((node): node is Declaration => node.type === "decl" && node.prop === "color")!.value
        );
};

test("watch reevaluates a bare app request when local module candidates appear and disappear", async () => {
    const appDir = path.join(root, "src/apps/alpha/content");
    const localPartial = path.join(appDir, "_tokens.scss");
    const localIndex = path.join(appDir, "tokens/_index.scss");
    const entry = path.join(appDir, "content.scss");
    const unchangedEntry = await readFile(entry, "utf8");
    compiler = await createCompiler(root, "alpha");
    let complete: ((error: Error | null, stats?: Stats) => void) | undefined;

    const next = (description: string, color: string, update?: () => Promise<void>) =>
        new Promise<Stats>((resolve, reject) => {
            const timer = setTimeout(() => {
                complete = undefined;
                reject(new Error(`Bare Sass module watch did not observe ${description}`));
            }, 10_000);

            complete = (error, stats) => {
                if (
                    !error &&
                    stats &&
                    !stats.hasErrors() &&
                    !entries.every(
                        name => JSON.stringify(colors(stats.compilation, name)) === JSON.stringify(["red", color])
                    )
                ) {
                    return;
                }

                clearTimeout(timer);
                complete = undefined;

                if (error || !stats || stats.hasErrors()) {
                    reject(error ?? new Error(stats?.toString({all: false, errors: true})));
                } else {
                    // The compiler reconnects its watcher after invoking this callback.
                    setImmediate(() => resolve(stats));
                }
            };

            void update?.().catch(error => complete?.(error));
        });

    const updateFrom = async (destination: string, filename: string): Promise<void> => {
        await writeFile(destination, await readFile(path.join(fixtures, "bare-module-watch-updates", filename)));
    };

    const initial = next("the shared fallback", "red");
    const watcher = compiler.watch({poll: 50}, (error, stats) => complete?.(error, stats));

    try {
        let stats = await initial;
        const badge = getBadgeClass(stats.compilation, "normal");
        expect(stats.compilation.missingDependencies.has(localPartial)).toBe(true);
        expect(stats.compilation.missingDependencies.has(localIndex)).toBe(true);

        stats = await next("local partial creation", "blue", () => updateFrom(localPartial, "created.scss"));
        expect(stats.compilation.fileDependencies.has(localPartial)).toBe(true);
        expect(getBadgeClass(stats.compilation, "normal")).toBe(badge);

        stats = await next("local partial edit", "green", () => updateFrom(localPartial, "updated.scss"));
        expect(getBadgeClass(stats.compilation, "normal")).toBe(badge);

        stats = await next("local partial removal and shared fallback", "red", () => unlink(localPartial));
        expect(stats.compilation.missingDependencies.has(localPartial)).toBe(true);
        expect(getBadgeClass(stats.compilation, "normal")).toBe(badge);

        stats = await next("local partial recreation", "blue", () => updateFrom(localPartial, "created.scss"));
        expect(getBadgeClass(stats.compilation, "normal")).toBe(badge);

        stats = await next("a replacement directory index", "purple", async () => {
            await unlink(localPartial);
            await mkdir(path.dirname(localIndex));
            await updateFrom(localIndex, "index.scss");
        });

        expect(stats.compilation.fileDependencies.has(localIndex)).toBe(true);
        expect(stats.compilation.missingDependencies.has(localPartial)).toBe(true);
        expect(getBadgeClass(stats.compilation, "normal")).toBe(badge);
        expect(getBadgeClass(stats.compilation, "document")).toBe(badge);
        expect(await readFile(entry, "utf8")).toBe(unchangedEntry);
    } finally {
        await new Promise<void>(resolve => watcher.close(resolve));
    }
}, 30_000);

test.each([
    {request: "../theme/fonts", source: "parent.scss", directory: "theme/fonts"},
    {request: "./fonts", source: "child.scss", directory: "content/fonts"},
])(
    "watch recovers a missing explicit $request import without changing its caller",
    async ({source, directory}) => {
        const appDir = path.join(root, "src/apps/alpha");
        const entry = path.join(appDir, "content/content.scss");
        const index = path.join(appDir, directory, "_index.scss");
        const updates = path.join(fixtures, "relative-module-watch-updates");

        await writeFile(
            path.join(root, "src/shared/content/content.scss"),
            await readFile(path.join(updates, "shared.scss"))
        );

        await writeFile(entry, await readFile(path.join(updates, source)));
        // Observe the missing file itself, rather than incidental creation of its parent directory.
        await mkdir(path.dirname(index), {recursive: true});
        const unchangedEntry = await readFile(entry, "utf8");
        compiler = await createCompiler(root, "alpha");
        let complete: ((error: Error | null, stats?: Stats) => void) | undefined;

        const next = (description: string, expectErrors: boolean, update?: () => Promise<void>) =>
            new Promise<Stats>((resolve, reject) => {
                const timer = setTimeout(() => {
                    complete = undefined;
                    reject(new Error(`Explicit Sass module watch did not observe ${description}`));
                }, 10_000);

                complete = (error, stats) => {
                    if (!error && stats) {
                        if (stats.hasErrors() !== expectErrors) {
                            return;
                        }

                        // A setup-triggered rebuild may succeed before polling observes the new file.
                        // Advance only after the watcher reports this phase's actual file change.
                        const changes = expectErrors ? compiler?.removedFiles : compiler?.modifiedFiles;

                        if (update && !changes?.has(index)) {
                            return;
                        }
                    }

                    clearTimeout(timer);
                    complete = undefined;

                    if (error || !stats) {
                        reject(error ?? new Error("Explicit Sass module watch did not return stats"));
                    } else {
                        setImmediate(() => resolve(stats));
                    }
                };

                void update?.().catch(error => complete?.(error));
            });

        const createIndex = async (): Promise<void> => {
            await mkdir(path.dirname(index), {recursive: true});
            await writeFile(index, await readFile(path.join(updates, "index.scss")));
        };

        const initial = next("the missing import error", true);
        const watcher = compiler.watch({poll: 50}, (error, stats) => complete?.(error, stats));

        try {
            const missing = await initial;
            expect(missing.toString({all: false, errors: true})).toContain("Can't find stylesheet to import");
            expect(missing.compilation.missingDependencies.has(index)).toBe(true);

            let stats = await next("index creation and recovery", false, createIndex);
            expect(stats.compilation.fileDependencies.has(index)).toBe(true);
            const badge = getBadgeClass(stats.compilation, "normal");

            for (const name of entries) {
                expect(colors(stats.compilation, name)).toEqual(["red", "blue"]);
            }

            stats = await next("index removal and the missing import error", true, () => unlink(index));
            expect(stats.toString({all: false, errors: true})).toContain("Can't find stylesheet to import");
            expect(stats.compilation.missingDependencies.has(index)).toBe(true);

            stats = await next("index recreation and recovery", false, createIndex);
            expect(getBadgeClass(stats.compilation, "normal")).toBe(badge);
            expect(getBadgeClass(stats.compilation, "document")).toBe(badge);

            for (const name of entries) {
                expect(colors(stats.compilation, name)).toEqual(["red", "blue"]);
            }

            expect(await readFile(entry, "utf8")).toBe(unchangedEntry);
        } finally {
            await new Promise<void>(resolve => watcher.close(resolve));
        }
    },
    30_000
);
