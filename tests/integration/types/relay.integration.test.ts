import path from "path";
import ts from "typescript";

describe("Relay entrypoint contracts", () => {
    const projectDir = path.resolve(__dirname, "../../..");
    const fixture = path.join(__dirname, "fixtures/relay/definition.ts");

    test.each(["source", "package"])(
        "checks Relay constructors and bootstrap through the %s API",
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

            const rootNames = [fixture];

            if (mode === "source") {
                rootNames.push(
                    path.join(__dirname, "fixtures/relay/virtual.ts"),
                    path.join(projectDir, "src/cli/virtual/relay.ts"),
                    path.join(projectDir, "src/cli/virtual/virtual.d.ts")
                );
            }

            const host = ts.createCompilerHost(options);
            const program = ts.createProgram(rootNames, options, host);

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
        },
        30_000
    );
});
