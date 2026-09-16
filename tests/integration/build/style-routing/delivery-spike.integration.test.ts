import fs from "fs";
import os from "os";
import path from "path";
import {setImmediate} from "timers";
import type {Filename, NormalModule, Stats} from "@rspack/core";
import {getCompilationBuildAssets} from "@cli/bundler/plugins/utils";
import {
    closeCompiler,
    contentEntries,
    createCompiler,
    fixtures,
    mainLayer,
    project,
    runCompiler,
    worldLayer,
} from "./delivery-spike/compiler";
import {executeEntry} from "./delivery-spike/runtime";

const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const assetText = (stats: Stats, file: string) => stats.compilation.getAsset(file)!.source.source().toString();
const readManifest = (stats: Stats): chrome.runtime.ManifestV3 => JSON.parse(assetText(stats, "manifest.json"));
const cssText = (stats: Stats, files: readonly string[]) => files.map(file => assetText(stats, file)).join("\n");

const moduleIds = (stats: Stats, resource: string) =>
    [...stats.compilation.modules]
        .filter(module => (module as NormalModule).resource === resource)
        .map(module => ({layer: module.layer ?? null, id: stats.compilation.chunkGraph.getModuleId(module)}));

const verifyGraph = (stats: Stats, commonChunks: boolean) => {
    for (const resource of [
        path.join(fixtures, "Panel.js"),
        path.join(project, "node_modules/react/index.js"),
        path.join(project, "node_modules/@addon-core/browser/dist/index.js"),
        path.join(project, "dist/entry/content/lifecycle/Builder.js"),
    ]) {
        const modules = moduleIds(stats, resource);
        expect(modules.map(module => module.layer).sort()).toEqual([worldLayer, mainLayer, null].sort());
        expect(new Set(modules.map(module => module.id)).size).toBe(3);
    }

    const panel = [...stats.compilation.modules].find(
        module => (module as NormalModule).resource === path.join(fixtures, "Panel.js") && module.layer === worldLayer
    )!;
    const chunks = stats.compilation.chunkGraph.getModuleChunks(panel);
    expect(chunks).toHaveLength(commonChunks ? 1 : contentEntries.length);

    const background = stats.compilation.entrypoints.get("background")!.getFiles();

    for (const entry of contentEntries) {
        expect(
            stats.compilation.entrypoints
                .get(entry)!
                .getFiles()
                .some(file => background.includes(file))
        ).toBe(false);
    }
};

const verifyDelivery = (stats: Stats, entry: string, isolated: boolean) => {
    const map = getCompilationBuildAssets(stats.compilation)!;
    const manifest = readManifest(stats);
    const content = manifest.content_scripts!.find(script => script.js?.includes(map[entry].initial.js.at(-1)!))!;
    expect(content).toBeDefined();
    const documentCss = cssText(stats, content.css ?? []);
    expect(documentCss).toContain("--delivery-document: initial");
    expect(documentCss).toContain("--delivery-document-child: inherited");
    expect(documentCss.includes("--delivery-ui: shared")).toBe(!isolated);
    expect(documentCss.includes("--vendor-style: inherited")).toBe(!isolated);
    expect(documentCss).not.toContain("--delivery-ui: lazy");
    expect(documentCss).not.toContain("--delivery-document: lazy");

    const harness = executeEntry(stats, entry);

    try {
        expect(harness.probe.assets()).toEqual({initial: map[entry].initial, async: map[entry].async});
        expect(harness.probe.styles() !== undefined).toBe(isolated);
        expect(harness.scripts).toEqual([]);

        if (isolated) {
            harness.addRoot(entry === "iframe" ? "iframe" : "shadow");
            const files = harness.requests.map(request => request.file);
            const styles = cssText(stats, files);
            expect(styles).toContain("--delivery-ui: shared");
            expect(styles).toContain("--vendor-style: inherited");
            expect(styles).not.toContain("--delivery-document");
            expect(manifest.web_accessible_resources!.flatMap(rule => rule.resources)).toEqual(
                expect.arrayContaining(files)
            );

            // The ordinary entry retains both categories together in its own stylesheet.
            const normal = manifest.content_scripts!.find(script =>
                script.js?.includes(map.normal.initial.js.at(-1)!)
            )!;
            expect(cssText(stats, normal.css ?? [])).toContain("--delivery-ui: shared");
            expect(cssText(stats, normal.css ?? [])).toContain("--delivery-document: initial");
        }
    } finally {
        harness.close();
    }
};

const verifyLazy = async (stats: Stats, entry: string, isolated: boolean) => {
    const harness = executeEntry(stats, entry);

    try {
        if (isolated) {
            harness.addRoot("shadow", "shadow-a");
            harness.addRoot("iframe", "iframe-a");

            for (const request of harness.requests) {
                harness.settle(request);
            }
        }

        const initialCount = harness.requests.length;
        const loaded = harness.probe.load();
        let complete = false;
        void loaded.then(() => {
            complete = true;
        });
        const requests = harness.requests.slice(initialCount);
        expect(harness.scripts.length).toBeGreaterThan(0);
        expect(requests.map(request => request.target).sort()).toEqual(
            isolated ? ["document", "iframe-a", "shadow-a"] : Array(entry === "popup" ? 1 : 2).fill("document")
        );

        if (isolated) {
            expect(
                cssText(
                    stats,
                    requests.filter(request => request.target === "document").map(request => request.file)
                )
            ).toContain("--delivery-document: lazy");
            expect(
                cssText(
                    stats,
                    requests.filter(request => request.target !== "document").map(request => request.file)
                )
            ).not.toContain("--delivery-document");
        }

        const last = isolated
            ? requests.find(request => request.target === (entry === "iframe" ? "document" : "iframe-a"))!
            : requests.at(-1)!;

        for (const request of requests.filter(request => request !== last)) {
            harness.settle(request);
        }

        await flush();
        expect(complete).toBe(false);
        harness.settle(last);
        await expect(loaded).resolves.toEqual(expect.objectContaining({loaded: true}));

        if (isolated) {
            const count = harness.requests.length;
            harness.addRoot("shadow", "late");
            const late = harness.requests.slice(count);
            expect(
                cssText(
                    stats,
                    late.map(request => request.file)
                )
            ).toContain("--delivery-ui: lazy");
            expect(
                cssText(
                    stats,
                    late.map(request => request.file)
                )
            ).not.toContain("--delivery-document");
        }
    } finally {
        harness.close();
    }
};

test.each<{name: string; filename: Filename; cssFilename: Filename; commonChunks: boolean}>([
    ...["contenthash", "chunkhash", "fullhash"].map(hash => ({
        name: hash,
        filename: `js/[name].[${hash}:8].js`,
        cssFilename: `css/[name].[${hash}:8].css`,
        commonChunks: true,
    })),
    {
        name: "callback",
        filename: () => "custom/[name].[contenthash:8].js",
        cssFilename: () => "custom/[name].[contenthash:8].css",
        commonChunks: true,
    },
    {
        name: "without common chunks",
        filename: "js/[name].[contenthash:8].js",
        cssFilename: "css/[name].[contenthash:8].css",
        commonChunks: false,
    },
])("routes CSS per entry without splitting its JavaScript layer ($name)", async options => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-delivery-spike-"));
    const compiler = await createCompiler(output, options);

    try {
        const stats = await runCompiler(compiler);
        verifyGraph(stats, options.commonChunks);

        // Separate entry runtimes execute in the same page/global chunk queue.
        const sharedContext = executeEntry(stats, "shadow");

        try {
            const iframe = sharedContext.loadEntry("iframe");
            const normal = sharedContext.loadEntry("normal");
            expect(iframe.styles()).not.toBe(sharedContext.probe.styles());
            expect(normal.styles()).toBeUndefined();
            const map = getCompilationBuildAssets(stats.compilation)!;

            for (const [entry, probe] of [
                ["shadow", sharedContext.probe],
                ["iframe", iframe],
                ["normal", normal],
            ] as const) {
                expect(probe.assets()).toEqual({initial: map[entry].initial, async: map[entry].async});
            }
        } finally {
            sharedContext.close();
        }

        for (const entry of contentEntries) {
            verifyDelivery(stats, entry, ["shadow", "iframe", "relay"].includes(entry));
        }

        for (const entry of ["normal", "shadow", "iframe", "popup"]) {
            await verifyLazy(stats, entry, entry === "shadow" || entry === "iframe");
        }
    } finally {
        await closeCompiler(compiler);
        fs.rmSync(output, {recursive: true, force: true});
    }
});

test("watch switches document/shadow/iframe delivery without changing JavaScript module identities", async () => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-delivery-watch-"));
    const selectionFile = path.join(output, "selection.json");
    const states = path.join(__dirname, "delivery-spike/states");
    fs.copyFileSync(path.join(states, "none.json"), selectionFile);
    const compiler = await createCompiler(path.join(output, "dist"), {selectionFile});
    let completion: ((error: Error | null, stats?: Stats) => void) | undefined;

    const next = (update?: () => void) =>
        new Promise<Stats>((resolve, reject) => {
            const timer = setTimeout(() => {
                completion = undefined;
                reject(new Error("Delivery spike watch did not finish the requested CSS destination change"));
            }, 10_000);
            completion = (error, stats) => {
                clearTimeout(timer);
                completion = undefined;

                if (error || !stats || stats.hasErrors()) {
                    reject(error ?? new Error(stats?.toString({all: false, errors: true})));
                } else {
                    resolve(stats);
                }
            };
            update?.();
        });
    const first = next();
    const watcher = compiler.watch({poll: 50}, (error, stats) => completion?.(error, stats));

    try {
        let stats = await first;
        const identities = moduleIds(stats, path.join(fixtures, "Panel.js"));
        verifyDelivery(stats, "switch", false);

        for (const state of ["shadow", "iframe", "none", "shadow"]) {
            await flush();
            stats = await next(() => {
                fs.writeFileSync(selectionFile, fs.readFileSync(path.join(states, state + ".json")));
            });
            verifyGraph(stats, true);
            expect(moduleIds(stats, path.join(fixtures, "Panel.js"))).toEqual(identities);
            expect(getCompilationBuildAssets(stats.compilation)!.switch.initial.css).toHaveLength(
                state === "none" ? 1 : 2
            );
            verifyDelivery(stats, "switch", state !== "none");
            await verifyLazy(stats, "switch", state !== "none");
        }
    } finally {
        await new Promise<void>(resolve => watcher.close(resolve));
        await closeCompiler(compiler);
        fs.rmSync(output, {recursive: true, force: true});
    }
}, 30_000);
