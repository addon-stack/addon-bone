import {Plugin} from "esbuild";
import {defineConfig} from "tsup";
import rawPlugin from "esbuild-plugin-raw";
import {fixImportsPlugin} from "esbuild-fix-imports-plugin";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function fixCliIndexImports(src: string, targets: string[]): string {
    if (targets.length === 0) return src;

    const group = targets.map(escapeRe).join("|");

    // 1) Alias: '@cli/<name>' or '@cli/<name>.js' -> '@cli/<name>/index.js'
    const aliasRe = new RegExp(String.raw`(["'])@cli\/(${group})(?:\.js)?\1`, "g");

    src = src.replace(aliasRe, (_m: string, q: string, mod: string) => {
        return `${q}@cli/${mod}/index.js${q}`;
    });

    // 2) Any path ending with '/cli/<name>' or '/cli/<name>.js' but not already '/index.*'
    const pathRe = new RegExp(
        String.raw`(["'])([^"'\n]*\bcli\/(?:${group}))(?!\/index(?:\.(?:mjs|cjs|js|ts|jsx|tsx))?)(?:\.js)?\1`,
        "g"
    );

    src = src.replace(pathRe, (_m: string, q: string, base: string) => {
        return `${q}${base}/index.js${q}`;
    });

    return src;
}

const fixVirtualIndexImportPlugin = (): Plugin => ({
    name: "fix-virtual-index-import",
    setup(build) {
        const targets = ["virtual", "entrypoint"];
        build.onLoad({filter: /\.(ts|tsx|js|jsx)$/}, async args => {
            const {readFile} = await import("fs/promises");
            let contents = await readFile(args.path, "utf8");

            contents = fixCliIndexImports(contents, targets);

            const ext = args.path.endsWith(".tsx")
                ? "tsx"
                : args.path.endsWith(".ts")
                  ? "ts"
                  : args.path.endsWith(".jsx")
                    ? "jsx"
                    : "js";

            return {
                contents,
                loader: ext,
            };
        });
    },
});

export default defineConfig([
    {
        entry: [
            "src/**/*.{ts,tsx}",
            "!src/**/tests/**/*",
            "!src/**/__tests__/**/*",
            "!src/**/__mocks__/**/*",
            "!src/**/*.{test,spec}.{ts,tsx}",
            "!src/**/*.d.ts",
            "!src/cli/virtual/**/*",
            "!src/cli/entrypoint/file/fixtures/**",
        ],
        bundle: false,
        format: ["esm"],
        outDir: "dist",
        target: "node14",
        clean: true,
        dts: true,
        sourcemap: true,
        // @ts-ignore
        esbuildPlugins: [fixVirtualIndexImportPlugin(), fixImportsPlugin()],
        esbuildOptions: options => {
            options.outbase = "src";
        },
        outExtension: () => ({js: ".js"}),
    },
    {
        entry: ["src/cli/virtual/index.ts"],
        format: ["esm"],
        bundle: true,
        outDir: "dist",
        target: "node14",
        clean: false,
        dts: false,
        sourcemap: false,
        external: [/^@cli/],
        // @ts-ignore
        esbuildPlugins: [fixVirtualIndexImportPlugin(), rawPlugin(), fixImportsPlugin()],
        esbuildOptions: options => {
            options.outbase = "src";
        },
        outExtension: () => ({js: ".js"}),
    },
]);
