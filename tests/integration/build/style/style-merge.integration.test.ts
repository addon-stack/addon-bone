import {readFile, rm, unlink, writeFile} from "fs/promises";
import path from "path";
import postcss from "postcss";
import type {Compilation, Compiler, NormalModule, Stats} from "@rspack/core";

import {DefaultStylesLayer, DocumentStylesLayer} from "@cli/bundler/layers";

import {closeCompiler, createCompiler, createFixture, entries, fixtures, getCss, runCompiler} from "./compiler";
import {assertSuccess, getBadgeClass, getFont, hasDeclaration} from "./style-output";

let root: string;
let compiler: Compiler | undefined;

beforeEach(async () => {
    root = await createFixture();
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

test.each([
    ["alpha", "blue"],
    ["beta", "green"],
])("merges %s styles into one CSS module per destination with its own resources", async (app, color) => {
    compiler = await createCompiler(root, app);
    const stats = await runCompiler(compiler);
    assertSuccess(stats);
    const {compilation} = stats;
    const badge = getBadgeClass(compilation, "normal");

    expect(badge).toMatch(new RegExp(`^${app}-badge__`));
    expect(getBadgeClass(compilation, "document")).toBe(badge);

    for (const entry of entries) {
        const css = getCss(compilation, entry);
        const selector = entry === "asis" ? ".badge" : `.${badge}`;
        const rules = postcss.parse(css).nodes.filter(node => node.type === "rule");

        expect(rules.map(rule => rule.selector)).toEqual([selector, selector]);
        expect(hasDeclaration(rules[0].toString(), "color", "red")).toBe(true);
        expect(hasDeclaration(rules[1].toString(), "color", color)).toBe(true);
        expect(hasDeclaration(css, "width", "2px")).toBe(true);
        expect(hasDeclaration(css, "--alias", "alias")).toBe(true);
        expect(hasDeclaration(css, "--package", "package")).toBe(true);
        expect(hasDeclaration(css, "font-weight", "400")).toBe(true);
        expect(css).toMatch(
            /url\(chrome-extension:\/\/__MSG_@@extension_id__\/assets\/Inter-Latin\.[a-f0-9]+\.woff2#face\)/
        );
    }

    const font = path.join(root, "src/apps", app, "theme/fonts/Inter-Latin.woff2");
    expect(Buffer.from(getFont(compilation))).toEqual(await readFile(font));

    const sharedPath = path.join(root, "src/shared/content/content.scss");
    const resources = [...compilation.modules]
        .filter((module): module is NormalModule => "resource" in module)
        .map(module => ({resource: module.resource, layer: module.layer}));

    expect(resources).toEqual(
        expect.arrayContaining([
            {resource: sharedPath, layer: DefaultStylesLayer},
            {resource: `${sharedPath}?unisolated`, layer: DocumentStylesLayer},
            {resource: `${sharedPath}?asis`, layer: DefaultStylesLayer},
        ])
    );

    for (const filename of ["content/content.scss", "theme/fonts/_index.scss", "theme/_metrics.scss"]) {
        expect(compilation.fileDependencies.has(path.join(root, "src/apps", app, filename))).toBe(true);
    }
});

test("mergeStyles=false compiles the shared source without loading the app override", async () => {
    compiler = await createCompiler(root, "alpha", false);
    const stats = await runCompiler(compiler);
    assertSuccess(stats);

    for (const entry of entries) {
        const css = getCss(stats.compilation, entry);

        expect(hasDeclaration(css, "--order", "shared")).toBe(true);
        expect(hasDeclaration(css, "--order", "app")).toBe(false);
        expect(css).not.toContain("@font-face");
    }

    expect(stats.compilation.fileDependencies.has(path.join(root, "src/apps/alpha/content/content.scss"))).toBe(false);
});

test.each([false, "source-map"] as const)(
    "resolves standalone partial assets with merging disabled and devtool=%s",
    async devtool => {
        compiler = await createCompiler(root, "beta", false, {
            mode: devtool ? "development" : "production",
            devtool,
            entry: {normal: "./standalone.js"},
        });

        const stats = await runCompiler(compiler);
        assertSuccess(stats);
        const css = getCss(stats.compilation, "normal");
        const font = path.join(root, "src/apps/beta/theme/fonts/Inter-Latin.woff2");

        expect(Buffer.from(getFont(stats.compilation))).toEqual(await readFile(font));
        expect(css).toMatch(/Inter-Latin\.[a-f0-9]+\.woff2#face/);
        expect(hasDeclaration(css, "--order", "app")).toBe(true);
        expect(hasDeclaration(css, "--order", "shared")).toBe(false);
        expect(stats.compilation.getAssets().some(asset => asset.name.endsWith(".css.map"))).toBe(Boolean(devtool));
    }
);

test.each([
    ["conflict", /already a module with namespace "sharedTokens"/],
    ["missing", /Can't find stylesheet to import/],
    ["invalid", /Unclosed block/],
])("fails the build for a %s app override", async (name, message) => {
    const appPath = path.join(root, "src/apps/alpha/content/content.scss");
    await writeFile(appPath, await readFile(path.join(fixtures, "multi-app-updates", `${name}.scss`)));
    compiler = await createCompiler(root, "alpha");
    const stats = await runCompiler(compiler);

    expect(stats.hasErrors()).toBe(true);
    expect(stats.toString({all: false, errors: true})).toMatch(message);
});

test.each(["alpha", "beta"])(
    "watch tracks %s override creation, edits, dependencies and removal",
    async app => {
        const appPath = path.join(root, "src/apps", app, "content/content.scss");
        const initialSource = path.join(fixtures, "multi-app/src/apps", app, "content/content.scss");
        const updatedSource = app === "beta" ? "content-default.scss" : "content.scss";
        await unlink(appPath);
        compiler = await createCompiler(root, app);
        let complete: ((error: Error | null, stats?: Stats) => void) | undefined;

        const next = (
            description: string,
            matches: (compilation: Compilation) => boolean,
            update?: () => Promise<void>,
            expectErrors = false
        ) =>
            new Promise<Stats>((resolve, reject) => {
                const timer = setTimeout(() => {
                    complete = undefined;
                    reject(new Error(`Style watch did not observe ${description} for ${app}`));
                }, 10_000);

                complete = (error, stats) => {
                    if (!error && stats && !stats.hasErrors() && (expectErrors || !matches(stats.compilation))) {
                        return;
                    }

                    clearTimeout(timer);
                    complete = undefined;

                    if (error || !stats || (!expectErrors && stats.hasErrors())) {
                        reject(error ?? new Error(stats?.toString({all: false, errors: true})));
                    } else {
                        // Rspack reconnects the watcher on nextTick after delivering its compilation callback.
                        setImmediate(() => resolve(stats));
                    }
                };

                void update?.().catch(error => complete?.(error));
            });

        const contains = (prop: string, value: string) => (compilation: Compilation) =>
            entries.every(entry => hasDeclaration(getCss(compilation, entry), prop, value));
        const updateFrom = async (destination: string, filename: string): Promise<void> => {
            await writeFile(destination, await readFile(path.join(fixtures, "multi-app-updates", filename)));
        };

        const initial = next("shared styles without an override", contains("--order", "shared"));
        const watcher = compiler.watch({poll: 50}, (error, stats) => complete?.(error, stats));

        try {
            let stats = await initial;
            const badge = getBadgeClass(stats.compilation, "normal");

            expect(stats.compilation.missingDependencies.has(appPath)).toBe(true);

            stats = await next("override creation", contains("--order", "app"), async () => {
                await writeFile(appPath, await readFile(initialSource));
            });

            expect(stats.compilation.fileDependencies.has(appPath)).toBe(true);
            expect(getBadgeClass(stats.compilation, "normal")).toBe(badge);

            stats = await next("override edit", contains("--order", "app-updated"), () =>
                updateFrom(appPath, updatedSource)
            );
            expect(getBadgeClass(stats.compilation, "normal")).toBe(badge);

            stats = await next(
                "invalid override error",
                () => true,
                () => updateFrom(appPath, "invalid.scss"),
                true
            );

            expect(stats.toString({all: false, errors: true})).toContain("Unclosed block");
            expect(stats.compilation.fileDependencies.has(appPath)).toBe(true);

            stats = await next("override correction", contains("--order", "app-updated"), () =>
                updateFrom(appPath, updatedSource)
            );

            expect(getBadgeClass(stats.compilation, "normal")).toBe(badge);

            await next("imported index edit", contains("font-family", "ExampleUpdated"), () =>
                updateFrom(path.join(root, "src/apps", app, "theme/fonts/_index.scss"), "fonts.scss")
            );

            await next("nested partial edit", contains("font-weight", "700"), () =>
                updateFrom(path.join(root, "src/apps", app, "theme/_metrics.scss"), "metrics.scss")
            );

            const expectedFont = await readFile(path.join(fixtures, "multi-app-updates/Inter-Latin.woff2"), "utf8");

            await next(
                "font resource edit",
                compilation => getFont(compilation) === expectedFont,
                () => updateFrom(path.join(root, "src/apps", app, "theme/fonts/Inter-Latin.woff2"), "Inter-Latin.woff2")
            );

            stats = await next(
                "override removal",
                compilation =>
                    entries.every(entry => !hasDeclaration(getCss(compilation, entry), "--order", "app-updated")),
                () => unlink(appPath)
            );

            expect(stats.compilation.missingDependencies.has(appPath)).toBe(true);
            expect(getFont(stats.compilation)).toBe("");
            expect(getBadgeClass(stats.compilation, "normal")).toBe(badge);

            stats = await next("override recreation", contains("--order", "app-updated"), () =>
                updateFrom(appPath, updatedSource)
            );

            expect(getBadgeClass(stats.compilation, "normal")).toBe(badge);
            expect(getFont(stats.compilation)).toBe(expectedFont);
        } finally {
            await new Promise<void>(resolve => watcher.close(resolve));
        }
    },
    30_000
);
