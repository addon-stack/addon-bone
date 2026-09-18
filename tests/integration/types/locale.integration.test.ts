import path from "path";
import ts from "typescript";

describe("locale contracts", () => {
    const fixture = path.join(__dirname, "fixtures/locale/substitutions.ts");

    test.each(["source", "package"])(
        "checks substitution arguments and plural keys through the %s API",
        mode => {
            const config = ts.readConfigFile(path.join(ADNBN_TEST_ROOT, "tsconfig.json"), ts.sys.readFile);
            const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ADNBN_TEST_ROOT);
            expect(config.error).toBeUndefined();
            expect(parsed.errors).toEqual([]);

            const options: ts.CompilerOptions = {
                ...(mode === "source" ? parsed.options : {}),
                module: ts.ModuleKind.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Bundler,
                target: ts.ScriptTarget.ESNext,
                strict: true,
                noEmit: true,
                skipLibCheck: mode === "source",
                types: ["node", "chrome"],
            };
            const host = ts.createCompilerHost(options);
            const program = ts.createProgram([fixture], options, host);
            const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => {
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
                const position = diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start ?? 0);

                return `${diagnostic.file?.fileName ?? "compiler"}:${(position?.line ?? 0) + 1}: ${message}`;
            });

            expect(diagnostics).toEqual([]);

            const apiFile = ts.resolveModuleName("adnbn/locale", fixture, options, host).resolvedModule
                ?.resolvedFileName;

            expect(apiFile).toBe(
                path
                    .join(ADNBN_TEST_ROOT, mode === "source" ? "src/locale/index.ts" : "dist/locale/index.d.ts")
                    .replace(/\\/g, "/")
            );
        },
        30_000
    );
});
