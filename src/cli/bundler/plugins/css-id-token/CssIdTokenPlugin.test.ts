import {createHash} from "node:crypto";
import fs from "node:fs/promises";
import {SourceMap, type SourceMapPayload} from "node:module";
import os from "node:os";
import path from "node:path";
import {rspack, CssExtractRspackPlugin, type Asset, type Compiler, type Stats} from "@rspack/core";

import {CssIdTokenPlugin} from "./index";

interface BuildOptions {
    context?: string;
    scheme?: string;
    sourceMap?: boolean;
}

interface CssBuild {
    filename: string;
    content: string;
}

const fixtures = path.resolve(__dirname, "tests/fixtures");
const projectRoot = path.resolve(__dirname, "../../../../..");
const compilers = new Set<Compiler>();
let directory: string;

beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "adnbn-css-extension-id-"));
});

afterEach(async () => {
    try {
        await Promise.all(
            Array.from(compilers, compiler => {
                return new Promise<void>((resolve, reject) => {
                    compiler.close(error => (error ? reject(error) : resolve()));
                });
            })
        );
    } finally {
        compilers.clear();
        await fs.rm(directory, {recursive: true, force: true});
    }
});

const createCompiler = ({context = fixtures, scheme = "chrome-extension", sourceMap = false}: BuildOptions = {}) => {
    const compiler = rspack({
        context,
        mode: "production",
        devtool: sourceMap ? "source-map" : false,
        entry: "./entry.js",
        output: {
            path: path.join(directory, `output-${compilers.size}`),
            filename: "bundle.[contenthash].js",
            assetModuleFilename: "assets/[name][ext]",
            publicPath: "",
            hashFunction: "sha256",
            hashDigest: "hex",
            hashDigestLength: 16,
        },
        resolveLoader: {modules: [path.join(projectRoot, "node_modules")]},
        module: {
            rules: [
                {
                    test: /\.css$/,
                    sideEffects: true,
                    type: "javascript/auto",
                    use: [CssExtractRspackPlugin.loader, {loader: "css-loader", options: {modules: false, sourceMap}}],
                },
                {
                    test: /\.(svg|bin)$/,
                    type: "asset/resource",
                    oneOf: [
                        {
                            resourceQuery: /browser/,
                            generator: {publicPath: `${scheme}://__MSG_@@extension_id__/`},
                        },
                    ],
                },
            ],
        },
        optimization: {realContentHash: true},
        plugins: [new CssExtractRspackPlugin({filename: "styles.[contenthash].css"}), new CssIdTokenPlugin()],
    });

    compilers.add(compiler);

    return compiler;
};

const run = (compiler: Compiler): Promise<Stats> => {
    return new Promise((resolve, reject) => {
        compiler.run((error, stats) => {
            if (error || !stats || stats.hasErrors()) {
                reject(error ?? new Error(stats?.toString({all: false, errors: true}) ?? "Missing compilation"));
            } else {
                resolve(stats);
            }
        });
    });
};

const cssAsset = (stats: Stats): Asset => {
    const asset = stats.compilation.getAssets().find(asset => asset.name.endsWith(".css"));

    if (!asset) {
        throw new Error("Expected an emitted CSS asset");
    }

    return asset;
};

test.each(["chrome-extension", "moz-extension", "safari-web-extension"])(
    "restores every extension ID token in CSS for %s and preserves other assets",
    async scheme => {
        const stats = await run(createCompiler({scheme}));
        const css = cssAsset(stats).source.source().toString();

        expect(css).toContain(`${scheme}://__MSG_@@extension_id__/assets/icon.svg#first`);
        expect(css).toContain(`${scheme}://__MSG_@@extension_id__/assets/icon.svg)`);
        expect(css).not.toContain("__MSG_%40@extension_id__");
        expect(css).toContain("__MSG_%40@ui_locale__");
        expect(css).toContain("__MSG_@@extension_id__ __MSG_%40@ui_locale__");

        const binary = stats.compilation.getAsset("assets/payload.bin")!;
        const script = stats.compilation.getAssets().find(asset => asset.name.endsWith(".js"))!;

        expect(binary.source.buffer()).toEqual(await fs.readFile(path.join(fixtures, "payload.bin")));
        expect(script.source.source().toString()).toContain("__MSG_%40@extension_id__");
    }
);

test("computes the final CSS content hash from the restored bytes", async () => {
    const stats = await run(createCompiler());
    const asset = cssAsset(stats);
    const hash = createHash("sha256").update(asset.source.buffer()).digest("hex").slice(0, 16);

    expect(asset.name).toBe(`styles.${hash}.css`);
});

test("preserves source mappings after multiple token replacements", async () => {
    const stats = await run(createCompiler({sourceMap: true}));
    const asset = cssAsset(stats);
    const css = asset.source.source().toString();
    const map = JSON.parse(
        stats.compilation.getAsset(`${asset.name}.map`)!.source.source().toString()
    ) as SourceMapPayload;
    const original = await fs.readFile(path.join(fixtures, "styles.css"), "utf8");
    const originalLines = original.split(/\r?\n/);
    // The CSS minimizer maps selectors. Check the selector after all restored URLs.
    const marker = ".unmodified";
    const originalLine = originalLines.findIndex(line => line.includes(marker));
    const markerIndex = css.indexOf(marker);

    expect(map.sourcesContent).toContain(original);
    expect(css).not.toContain("__MSG_%40@extension_id__");
    expect(markerIndex).toBeGreaterThanOrEqual(0);

    const beforeMarker = css.slice(0, markerIndex);

    expect(
        new SourceMap(map).findEntry(
            beforeMarker.split("\n").length - 1,
            beforeMarker.length - beforeMarker.lastIndexOf("\n") - 1
        )
    ).toMatchObject({
        originalSource: expect.stringContaining("styles.css"),
        originalLine,
        originalColumn: originalLines[originalLine].indexOf(marker),
    });
});

test("refreshes corrected CSS and hashes when URLs are removed and restored during watch", async () => {
    const context = path.join(directory, "watch");
    await fs.cp(fixtures, context, {recursive: true});

    const compiler = createCompiler({context});
    const builds: CssBuild[] = [];
    let failure: Error | undefined;
    let notify: (() => void) | undefined;
    const watcher = compiler.watch({poll: 50, aggregateTimeout: 20}, (error, stats) => {
        if (error || !stats || stats.hasErrors()) {
            failure = error ?? new Error(stats?.toString({all: false, errors: true}) ?? "Missing watch compilation");
        } else {
            const asset = cssAsset(stats);
            builds.push({filename: asset.name, content: asset.source.source().toString()});
        }

        notify?.();
    });

    const waitForBuild = (selector: string): Promise<CssBuild> => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                notify = undefined;
                reject(new Error(`Timed out waiting for CSS containing ${selector}`));
            }, 15_000);

            notify = () => {
                if (failure) {
                    clearTimeout(timer);
                    notify = undefined;
                    reject(failure);

                    return;
                }

                const build = builds.find(build => build.content.includes(selector));

                if (build) {
                    clearTimeout(timer);
                    notify = undefined;
                    resolve(build);
                }
            };

            notify();
        });
    };

    try {
        const initial = await waitForBuild(".initialProbe");

        expect(initial.content).toContain("chrome-extension://__MSG_@@extension_id__/assets/icon.svg#first");

        await fs.writeFile(
            path.join(context, "styles.css"),
            await fs.readFile(path.join(fixtures, "styles-clean.css"))
        );
        const clean = await waitForBuild(".cleanProbe");

        expect(clean.content).not.toContain("__MSG_");
        expect(clean.filename).not.toBe(initial.filename);

        await fs.writeFile(
            path.join(context, "styles.css"),
            await fs.readFile(path.join(fixtures, "styles-changed.css"))
        );
        const restored = await waitForBuild(".restoredProbe");

        expect(restored.content).toContain("chrome-extension://__MSG_@@extension_id__/assets/icon.svg#changed");
        expect(restored.content).not.toContain("__MSG_%40@extension_id__");
        expect(restored.content).not.toContain("#first");
        expect(restored.filename).not.toBe(initial.filename);
        expect(restored.filename).not.toBe(clean.filename);
    } finally {
        await new Promise<void>(resolve => {
            watcher.close(resolve);
        });
    }
}, 30_000);
