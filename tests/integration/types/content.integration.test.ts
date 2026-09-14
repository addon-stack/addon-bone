import path from "path";
import ts from "typescript";

describe("content contracts", () => {
    const projectDir = path.resolve(__dirname, "../../..");
    const fixture = path.join(__dirname, "fixtures/content/definition.tsx");
    const watchFixture = path.join(__dirname, "fixtures/content/watch.ts");

    test.each(["source", "package"])(
        "checks content definitions and watch strategies through the %s API",
        mode => {
            const config = ts.readConfigFile(path.join(projectDir, "tsconfig.json"), ts.sys.readFile);
            const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectDir);
            expect(config.error).toBeUndefined();
            expect(parsed.errors).toEqual([]);

            const options: ts.CompilerOptions = {
                ...(mode === "source" ? parsed.options : {}),
                module: ts.ModuleKind.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Bundler,
                target: ts.ScriptTarget.ESNext,
                jsx: ts.JsxEmit.ReactJSX,
                strict: true,
                noEmit: true,
                skipLibCheck: mode === "source",
                types: ["node", "chrome"],
            };

            const host = ts.createCompilerHost(options);

            const program = ts.createProgram(
                [fixture, watchFixture, path.join(__dirname, "fixtures/content/prepare.tsx")],
                options,
                host
            );

            const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => {
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
                const position = diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start ?? 0);

                return `${diagnostic.file?.fileName ?? "compiler"}:${(position?.line ?? 0) + 1}: ${message}`;
            });

            expect(diagnostics).toEqual([]);

            const apiFile = ts.resolveModuleName("adnbn", fixture, options, host).resolvedModule?.resolvedFileName;

            expect(apiFile).toBe(
                path.join(projectDir, mode === "source" ? "src/index.ts" : "dist/index.d.ts").replace(/\\/g, "/")
            );

            const contentFile = ts.resolveModuleName("adnbn/content", watchFixture, options, host).resolvedModule
                ?.resolvedFileName;

            expect(contentFile).toBe(
                path
                    .join(projectDir, mode === "source" ? "src/content/index.ts" : "dist/content/index.d.ts")
                    .replace(/\\/g, "/")
            );
        },
        30_000
    );
});
