import {createRequire} from "module";
import {execFile} from "child_process";
import {readFile, rm, writeFile} from "fs/promises";
import path from "path";
import {promisify} from "util";
import postcss, {type Declaration} from "postcss";
import type {Compiler, RuleSetRule} from "@rspack/core";

import {closeCompiler, createCompiler, createFixture, entries, fixtures, getCss, runCompiler} from "./compiler";
import {assertSuccess, getBadgeClass, getFont, hasDeclaration} from "./style-output";

const require = createRequire(import.meta.url);
let root: string;
let compiler: Compiler | undefined;

beforeEach(async () => {
    root = await createFixture("virtual-theme");
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

const createThemeCompiler = async (mergeStyles: boolean, devtool: false | "source-map" = false) => {
    return createCompiler(root, "alpha", mergeStyles, {
        mode: devtool ? "development" : "production",
        devtool,
    });
};

// A pre-existing plugin may insert its own URL resolver before Sass in the
// configured chain. Exercise that supported rule hook without depending on UI.
const addExternalUrlResolver = (target: Compiler): void => {
    let nextRule = 0;
    const patch = (rule: RuleSetRule): void => {
        for (const child of [...(rule.oneOf ?? []), ...(rule.rules ?? [])]) {
            if (child && typeof child === "object") {
                patch(child);
            }
        }

        const original = rule.use;

        if (!Array.isArray(original)) {
            return;
        }

        const ruleId = nextRule++;

        rule.use = data => {
            if (data.resource?.split("?")[0] !== path.join(root, "generated/style.scss")) {
                return original;
            }

            return original.flatMap((item, index) => {
                const entry = typeof item === "string" ? {loader: item} : item;

                if (!/(?:^|[/\\])sass-loader(?:[/\\]|$)/.test(entry.loader)) {
                    return [item];
                }

                if (typeof entry.options === "string") {
                    throw new Error("Expected Sass loader options to be an object");
                }

                return [
                    {
                        loader: require.resolve("resolve-url-loader"),
                        options: {sourceMap: Boolean(target.options.devtool)},
                    },
                    {
                        ...entry,
                        ident: `consumer-sass-${ruleId}-${index}`,
                        options: {...entry.options, sourceMap: true},
                    },
                ];
            });
        };
    };

    for (const rule of target.options.module.rules) {
        if (rule && typeof rule === "object") {
            patch(rule);
        }
    }
};

test.each([true, false])("compiles an already prepared virtual resource with mergeStyles=%s", async mergeStyles => {
    compiler = await createThemeCompiler(mergeStyles);
    const stats = await runCompiler(compiler);
    assertSuccess(stats);
    const badge = getBadgeClass(stats.compilation, "normal");
    expect(getBadgeClass(stats.compilation, "document")).toBe(badge);

    for (const entry of entries) {
        const css = getCss(stats.compilation, entry);
        const rules = postcss.parse(css).nodes.filter(node => node.type === "rule");
        const selector = entry === "asis" ? ".badge" : `.${badge}`;

        expect(rules.map(rule => rule.selector)).toEqual([selector, selector]);
        expect(
            rules.map(
                rule =>
                    rule.nodes.find((node): node is Declaration => node.type === "decl" && node.prop === "color")!.value
            )
        ).toEqual(["red", "blue"]);
        expect(css).toMatch(/shared\.[a-f0-9]+\.svg#shape/);
        expect(css).toMatch(/app\.[a-f0-9]+\.svg#shape/);
        expect(css).toMatch(/Virtual\.[a-f0-9]+\.woff2#face/);
    }
});

test("the production style pipeline loads its private ESM loader under native Node", async () => {
    await writeFile(
        path.join(root, "src/apps/alpha/theme/fonts/_index.scss"),
        await readFile(path.join(fixtures, "virtual-theme-updates/fonts-alias.scss"))
    );

    const {stdout, stderr} = await promisify(execFile)(
        process.execPath,
        [path.join(__dirname, "verify-native-consumer.mjs"), root],
        {timeout: 15_000, maxBuffer: 1024 * 1024}
    );

    expect(stdout).toContain("Native style consumer verified");
    expect(stderr).toBe("");
}, 20_000);

test("preserves an asset alias declared inside an imported partial", async () => {
    await writeFile(
        path.join(root, "src/apps/alpha/theme/fonts/_index.scss"),
        await readFile(path.join(fixtures, "virtual-theme-updates/fonts-alias.scss"))
    );

    compiler = await createThemeCompiler(true);
    const stats = await runCompiler(compiler);
    assertSuccess(stats);

    for (const entry of entries) {
        const css = getCss(stats.compilation, entry);

        expect(css).toMatch(/Virtual\.[a-f0-9]+\.woff2#alias/);
        expect(css).toMatch(/Virtual\.[a-f0-9]+\.woff2#face/);
    }
});

test.each([
    {devtool: false, configured: false},
    {devtool: false, configured: true},
    {devtool: "source-map", configured: false},
    {devtool: "source-map", configured: true},
] as const)(
    "coexists with an external URL resolver: devtool=$devtool, configured=$configured",
    async ({devtool, configured}) => {
        if (configured) {
            await writeFile(
                path.join(root, "generated/style.scss"),
                await readFile(path.join(fixtures, "virtual-theme-updates/generated.scss"))
            );
        }

        compiler = await createThemeCompiler(true, devtool);
        addExternalUrlResolver(compiler);
        const stats = await runCompiler(compiler);
        assertSuccess(stats);

        for (const entry of entries) {
            const css = getCss(stats.compilation, entry);

            expect(hasDeclaration(css, "--order", "shared")).toBe(true);
            expect(hasDeclaration(css, "--order", configured ? "app-updated" : "app")).toBe(true);
            expect(css).toMatch(new RegExp(`Virtual\\.[a-f0-9]+\\.woff2#${configured ? "configured" : "face"}`));
        }

        expect(getFont(stats.compilation)).toBe(
            await readFile(path.join(root, "src/apps/alpha/theme/fonts/Virtual.woff2"), "utf8")
        );
    }
);
