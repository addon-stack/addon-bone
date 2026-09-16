import {mkdtemp, readFile, rm, writeFile} from "fs/promises";
import os from "os";
import path from "path";
import type {NormalModule, Stats} from "@rspack/core";

import {getContentLayer} from "@cli/bundler/layers";
import {ContentScriptWorld} from "@typing/content";

import {closeCompiler, createCompiler, fixture, orders, runCompiler, watchSelections} from "./selective-split/compiler";

test("selective split keeps one shared lazy module and orders document CSS before UI CSS for both import orders", async () => {
    const output = await mkdtemp(path.join(os.tmpdir(), "adnbn-selective-split-"));
    const compiler = await createCompiler(output);

    try {
        const {compilation} = await runCompiler(compiler);
        expect(compilation.warnings).toHaveLength(0);

        for (const order of orders) {
            const modules = [...compilation.modules].filter(
                module => (module as NormalModule).resource === path.join(fixture, `${order}.js`)
            );

            expect(modules).toHaveLength(1);
            const chunks = compilation.chunkGraph.getModuleChunks(modules[0]);
            expect(chunks).toHaveLength(1);
            const groups = [...chunks[0].groupsIterable];
            expect(groups).toHaveLength(1);
            expect(
                groups[0]
                    .getParents()
                    .map(parent => parent.name)
                    .sort()
            ).toEqual(["normal", "shadow"]);

            const files = groups[0].chunks.flatMap(chunk => [...chunk.files].filter(file => file.endsWith(".css")));
            expect(files).toHaveLength(2);
            const sources = files.map(file => compilation.getAsset(file)!.source.source().toString());
            expect(sources[0]).toContain("--split-document:");
            expect(sources[0]).not.toContain("--split-ui:");
            expect(sources[1]).toContain("--split-ui:");
            expect(sources[1]).not.toContain("--split-document:");
        }
    } finally {
        await closeCompiler(compiler);
        await rm(output, {recursive: true, force: true});
    }
});

test("does not split the shared lazy CSS when neither consumer has isolated delivery", async () => {
    const output = await mkdtemp(path.join(os.tmpdir(), "adnbn-unselected-split-"));
    const compiler = await createCompiler(output, false);

    try {
        const {compilation} = await runCompiler(compiler);

        for (const order of orders) {
            const module = [...compilation.modules].find(
                module => (module as NormalModule).resource === path.join(fixture, `${order}.js`)
            )!;

            const [chunk] = compilation.chunkGraph.getModuleChunks(module);
            const [group] = chunk.groupsIterable;
            const files = group.chunks.flatMap(chunk => [...chunk.files].filter(file => file.endsWith(".css")));
            expect(files).toHaveLength(1);
            const source = compilation.getAsset(files[0])!.source.source().toString();
            const categories = [...source.matchAll(/--split-(document|ui):/g)].map(match => match[1]);
            expect(categories).toEqual(order === "document-first" ? ["document", "ui"] : ["ui", "document"]);
        }
    } finally {
        await closeCompiler(compiler);
        await rm(output, {recursive: true, force: true});
    }
});

test("ordinary initial CSS stays named and mixed in import order beside isolated entries", async () => {
    const output = await mkdtemp(path.join(os.tmpdir(), "adnbn-initial-split-"));
    const compiler = await createCompiler(output, true, {initial: true});

    try {
        const {compilation} = await runCompiler(compiler);
        expect(compilation.errors).toHaveLength(0);
        const manifest = JSON.parse(compilation.getAsset("manifest.json")!.source.source().toString());
        const war = manifest.web_accessible_resources.flatMap((rule: {resources: string[]}) => rule.resources);

        for (const order of orders) {
            for (const type of ["popup", "options", "page", "content", "relay"]) {
                const name = `${type}-${order}`;
                const entry = compilation.entrypoints.get(name)!;
                const files = entry.getFiles().filter(file => file.endsWith(".css"));
                expect(files).toEqual([expect.stringMatching(new RegExp(`^css/${name}\\.[a-f0-9]+\\.css$`))]);
                const source = compilation.getAsset(files[0])!.source.source().toString();
                const categories = [...source.matchAll(/--split-(document|ui):/g)].map(match => match[1]);
                expect(categories).toEqual(order === "document-first" ? ["document", "ui"] : ["ui", "document"]);

                if (type === "content" || type === "relay") {
                    const script = manifest.content_scripts.find((script: {js: string[]}) =>
                        script.js.some(file => entry.getFiles().includes(file))
                    );
                    expect(script.css).toEqual(files);
                    expect(war).not.toEqual(expect.arrayContaining(files));
                }
            }

            const name = `shadow-${order}`;
            const entry = compilation.entrypoints.get(name)!;
            const files = entry.getFiles().filter(file => file.endsWith(".css"));
            expect(files).toHaveLength(2);
            const ui = files.find(file =>
                compilation.getAsset(file)!.source.source().toString().includes("--split-ui:")
            )!;
            const document = files.find(file => file !== ui)!;
            expect(ui).toMatch(new RegExp(`^css/${name}\\.[a-f0-9]+\\.css$`));
            const script = manifest.content_scripts.find((script: {js: string[]}) =>
                script.js.some(file => entry.getFiles().includes(file))
            );
            expect(script.css).toEqual([document]);
            expect(war).toContain(ui);
        }

        for (const chunk of compilation.entrypoints.get("shadow")!.getEntrypointChunk().getAllAsyncChunks()) {
            for (const file of chunk.files) {
                if (file.endsWith(".css")) {
                    expect(war).toContain(file);
                }
            }
        }
    } finally {
        await closeCompiler(compiler);
        await rm(output, {recursive: true, force: true});
    }
});

test("watch adds and removes the shared lazy split and restores the ordinary CSS runtime", async () => {
    const output = await mkdtemp(path.join(os.tmpdir(), "adnbn-selective-watch-"));
    const selectionFile = path.join(output, "selection.json");
    const setState = async (state: string) =>
        writeFile(selectionFile, await readFile(path.join(__dirname, "delivery-spike/states", `${state}.json`)));
    await setState("none");
    const compiler = await createCompiler(output, false, {initial: true, selectionFile});
    let queuedState: string | undefined;

    compiler.hooks.done.tapPromise("ChangeSelectionBeforeWatchResult", async () => {
        if (queuedState === undefined) {
            return;
        }

        const state = queuedState;
        queuedState = undefined;
        await setState(state);
    });

    let complete: ((error: Error | null, stats?: Stats) => void) | undefined;
    const next = (isolated: boolean, update?: () => Promise<void>) =>
        new Promise<Stats>((resolve, reject) => {
            let observed: boolean | undefined;
            const timer = setTimeout(() => {
                complete = undefined;
                reject(
                    new Error(
                        `Selective CSS watch expected isolation=${isolated}, last compilation selected ${observed ?? "unknown"}`
                    )
                );
            }, 10_000);

            complete = (error, stats) => {
                if (!error && stats && !stats.hasErrors()) {
                    observed = watchSelections.get(stats.compilation);

                    if (observed !== isolated) {
                        return;
                    }
                }

                clearTimeout(timer);
                complete = undefined;

                if (error || !stats || stats.hasErrors()) {
                    reject(error ?? new Error(stats?.toString({all: false, errors: true})));
                } else {
                    resolve(stats);
                }
            };

            void update?.().catch(error => complete?.(error));
        });

    const initial = next(false);
    const watcher = compiler.watch({poll: 50}, (error, stats) => complete?.(error, stats));

    try {
        let stats = await initial;
        const identities = new Map<string, string | number | null>();
        let previousIsolatedCss: string | undefined;

        for (const [index, state] of ["none", "shadow", "none", "shadow", "none"].entries()) {
            const isolated = state === "shadow";

            if (index === 1) {
                // Change the input after compilation, before its watch callback: that result is stale.
                stats = await next(isolated, async () => {
                    queuedState = state;
                    watcher.invalidate();
                });
            } else if (index > 1) {
                stats = await next(isolated, () => setState(state));
            }

            const {compilation} = stats;

            for (const order of orders) {
                const module = [...compilation.modules].find(
                    module =>
                        (module as NormalModule).resource === path.join(fixture, `${order}.js`) &&
                        module.layer === getContentLayer(ContentScriptWorld.Isolated)
                )!;
                const id = compilation.chunkGraph.getModuleId(module);

                if (identities.has(order)) {
                    expect(id).toBe(identities.get(order));
                }

                identities.set(order, id);
                const chunks = compilation.chunkGraph.getModuleChunks(module);
                const lazy = chunks.find(chunk => [...chunk.groupsIterable].some(group => !group.isInitial()))!;
                const group = [...lazy.groupsIterable].find(group => !group.isInitial())!;
                expect(
                    group.chunks.flatMap(chunk => [...chunk.files].filter(file => file.endsWith(".css")))
                ).toHaveLength(isolated ? 2 : 1);
            }

            const runtime = compilation.entrypoints
                .get("shadow")!
                .getFiles()
                .filter(file => file.endsWith(".js"))
                .map(file => compilation.getAsset(file)!.source.source().toString())
                .join("\n");
            expect(runtime.includes("loadDocumentStylesheet")).toBe(isolated);
            expect(runtime.includes("isolatedStyleRoots")).toBe(isolated);
            const entry = compilation.entrypoints.get("shadow-document-first")!;
            const files = entry.getFiles();
            const manifest = JSON.parse(compilation.getAsset("manifest.json")!.source.source().toString());
            const script = manifest.content_scripts.find((script: {js: string[]}) =>
                script.js.some(file => files.includes(file))
            );
            const documentCss = script.css
                .map((file: string) => compilation.getAsset(file)!.source.source().toString())
                .join("\n");
            expect(documentCss.includes("--split-ui:")).toBe(!isolated);
            const war = manifest.web_accessible_resources.flatMap((rule: {resources: string[]}) => rule.resources);

            if (isolated) {
                previousIsolatedCss = files.find(
                    file =>
                        file.endsWith(".css") &&
                        compilation.getAsset(file)!.source.source().toString().includes("--split-ui:")
                );
                expect(war).toContain(previousIsolatedCss);
            } else if (previousIsolatedCss) {
                expect(war).not.toContain(previousIsolatedCss);
            }
        }
    } finally {
        await new Promise<void>(resolve => watcher.close(resolve));
        await closeCompiler(compiler);
        await rm(output, {recursive: true, force: true});
    }
}, 30_000);
