import {readFile, rm} from "fs/promises";
import path from "path";
import postcss from "postcss";
import type {Compiler} from "@rspack/core";

import {closeCompiler, createCompiler, createFixture, entries, getCss, runCompiler} from "./compiler";
import {assertSuccess, getBadgeClass, getFont, hasDeclaration} from "./style-output";

let root: string;
let compiler: Compiler | undefined;

beforeEach(async () => {
    root = await createFixture("font-reuse");
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

test.each([true, false])("a reused font mixin resolves its own resource with mergeStyles=%s", async mergeStyles => {
    compiler = await createCompiler(root, "alpha", mergeStyles, {
        ...(mergeStyles ? {} : {entry: {normal: "./standalone.js"}}),
    });

    const stats = await runCompiler(compiler);
    assertSuccess(stats);
    const {compilation} = stats;
    const font = path.join(root, "src/apps/alpha/theme/fonts/Geist.woff2");

    expect(Buffer.from(getFont(compilation))).toEqual(await readFile(font));
    expect(compilation.fileDependencies.has(font)).toBe(true);
    expect(compilation.fileDependencies.has(path.join(root, "src/shared/content/Geist.woff2"))).toBe(false);
    expect(compilation.fileDependencies.has(path.join(root, "src/apps/alpha/content/Geist.woff2"))).toBe(false);

    const badge = getBadgeClass(compilation, "normal");

    if (mergeStyles) {
        expect(getBadgeClass(compilation, "document")).toBe(badge);
    }

    for (const entry of mergeStyles ? entries : ["normal"]) {
        const css = getCss(compilation, entry);
        const rules = postcss.parse(css).nodes.filter(node => node.type === "rule");
        const selector = entry === "asis" ? ".badge" : `.${badge}`;

        expect(rules.map(rule => rule.selector)).toEqual(mergeStyles ? [selector, selector] : [selector]);
        expect(hasDeclaration(css, "font-family", "Geist")).toBe(true);
        expect(css).toMatch(/url\(chrome-extension:\/\/__MSG_@@extension_id__\/assets\/Geist\.[a-f0-9]+\.woff2#face\)/);
    }
});
