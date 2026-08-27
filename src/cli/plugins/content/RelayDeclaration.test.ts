import fs from "fs";
import os from "os";
import path from "path";
import ts from "typescript";

import RelayDeclaration from "./RelayDeclaration";

import type {ReadonlyConfig} from "@typing/config";

describe("Relay declarations", () => {
    const projectDir = path.resolve(__dirname, "../../../..");
    const fixtureDir = path.join(__dirname, "tests/fixtures/relay-types");
    const consumerFile = path.join(fixtureDir, "consumer.ts");
    const generatedFile = path.join(fixtureDir, "generated.d.ts");
    let rootDir: string;
    let declaration: string;

    beforeAll(() => {
        rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-relay-declaration-"));

        new RelayDeclaration({rootDir} as ReadonlyConfig)
            .dictionary({
                scanner:
                    "{ scan(text: string): number; load(): Promise<string>; nested: { ready(): boolean; count: number; }; }",
            })
            .build();

        declaration = fs.readFileSync(path.join(rootDir, ".adnbn/relay.d.ts"), "utf-8");
    });

    afterAll(() => {
        fs.rmSync(rootDir, {recursive: true, force: true});
    });

    test("generates only registry augmentation, not accessor overloads or provider imports", () => {
        expect(declaration).toContain('import "adnbn/relay"');
        expect(declaration).toContain('declare module "adnbn/relay"');
        expect(declaration).toContain("export interface RelayRegistry");
        expect(declaration).not.toContain("ProxyRelay");
        expect(declaration).not.toContain("getRelay");
        expect(declaration).not.toContain("[name: string]: any");
    });

    test.each(
        ["source", "package"].flatMap(mode => [
            {mode, pathStyle: "POSIX", generatedPath: generatedFile.replace(/\\/g, "/")},
            {mode, pathStyle: "Windows", generatedPath: generatedFile.replace(/\//g, "\\")},
        ])
    )(
        "checks the $mode API and generated scalar/batch contracts with $pathStyle paths",
        ({mode, generatedPath}) => {
            const configFile = ts.readConfigFile(path.join(projectDir, "tsconfig.json"), ts.sys.readFile);
            const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, projectDir);

            expect(configFile.error).toBeUndefined();
            expect(config.errors).toEqual([]);

            const options: ts.CompilerOptions = {
                ...(mode === "source" ? config.options : {}),
                module: ts.ModuleKind.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Bundler,
                target: ts.ScriptTarget.ESNext,
                strict: true,
                noEmit: true,
                skipLibCheck: true,
                types: ["node", "chrome"],
            };
            const rootNames = [consumerFile, generatedPath];

            if (mode === "source") {
                rootNames.push(
                    path.join(fixtureDir, "virtual.ts"),
                    path.join(projectDir, "src/cli/virtual/relay.ts"),
                    path.join(projectDir, "src/cli/virtual/virtual.d.ts")
                );
            }

            // Give the real generated declaration a consumer-side location so package self-resolution works.
            // The package case deliberately has neither source aliases nor ambient virtual module declarations.
            const host = ts.createCompilerHost(options);
            const getSourceFile = host.getSourceFile.bind(host);
            // TypeScript uses forward slashes even when the root file has a native Windows path.
            const generatedFileName = generatedPath.replace(/\\/g, "/");

            host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) =>
                file.replace(/\\/g, "/") === generatedFileName
                    ? ts.createSourceFile(file, declaration, languageVersion, true)
                    : getSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile);

            const program = ts.createProgram(rootNames, options, host);
            const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => {
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
                const position = diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start ?? 0);

                return `${diagnostic.file?.fileName ?? "compiler"}:${(position?.line ?? 0) + 1}: ${message}`;
            });

            expect(diagnostics).toEqual([]);

            const checker = program.getTypeChecker();
            const consumer = program.getSourceFile(consumerFile)!;
            const exportsOf = (moduleName: string): string[] => {
                const statement = consumer.statements.find(
                    statement =>
                        ts.isImportDeclaration(statement) &&
                        ts.isStringLiteral(statement.moduleSpecifier) &&
                        statement.moduleSpecifier.text === moduleName
                ) as ts.ImportDeclaration;
                const symbol = checker.getSymbolAtLocation(statement.moduleSpecifier)!;

                return checker
                    .getExportsOfModule(symbol)
                    .map(symbol => symbol.name)
                    .sort();
            };

            expect(exportsOf("adnbn/relay")).toEqual(["RelayName", "RelayRegistry", "RelayTarget", "getRelay"]);
            expect(exportsOf("adnbn/entry/relay")).toEqual(["Builder", "RelayUnresolvedDefinition", "default"]);
            expect(exportsOf("adnbn").filter(name => /Relay/.test(name))).toEqual([
                "RelayAllFrames",
                "RelayAllFramesOptions",
                "RelayAnyFramesOptions",
                "RelayBatchOptions",
                "RelayBatchProxyTarget",
                "RelayBatchRpcProxy",
                "RelayCallOptions",
                "RelayDefinition",
                "RelayDiscoveryError",
                "RelayDocumentOptions",
                "RelayDocumentsOptions",
                "RelayEveryFrameOptions",
                "RelayExecutionOptions",
                "RelayFrameError",
                "RelayFrameErrorKind",
                "RelayFrameOptions",
                "RelayFrameResult",
                "RelayFramesOptions",
                "RelayFramesResult",
                "RelayMethod",
                "RelayNonEmptyReadonlyArray",
                "RelayProxyTarget",
                "RelayResultTarget",
                "RelayScalarOptions",
                "RelayTopFrameOptions",
                "defineRelay",
                "getRelay",
            ]);

            const apiFile = ts.resolveModuleName("adnbn", consumerFile, options, host).resolvedModule?.resolvedFileName;

            expect(apiFile).toBe(
                path.join(projectDir, mode === "source" ? "src/index.ts" : "dist/index.d.ts").replace(/\\/g, "/")
            );
        },
        30_000
    );
});
