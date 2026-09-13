import fs from "fs";
import os from "os";
import path from "path";
import ts from "typescript";

import PopupDeclaration from "@cli/plugins/popup/declaration/PopupDeclaration";
import SidebarDeclaration from "@cli/plugins/sidebar/declaration/SidebarDeclaration";
import IconDeclaration from "@cli/plugins/icon/declaration/IconDeclaration";
import TransportDeclaration, {
    TransportDeclarationLayer,
} from "@cli/plugins/typescript/declaration/transport/TransportDeclaration";
import type {ReadonlyConfig} from "@typing/config";

describe("shared registries", () => {
    const projectDir = path.resolve(__dirname, "../../..");
    const fixtureDir = path.join(__dirname, "fixtures/registries");
    let rootDir: string;
    let filled: string;
    let empty: string;

    const generate = (directory: string, populated: boolean): string => {
        const config = {rootDir: directory} as ReadonlyConfig;
        new PopupDeclaration(config).setAlias(new Set(populated ? ["popup", 'quoted"popup'] : [])).build();
        new SidebarDeclaration(config).setAlias(new Set(populated ? ["sidebar"] : [])).build();
        new IconDeclaration(config).setNames(new Set(populated ? ["brand"] : [])).build();

        for (const [layer, name, signature] of [
            [TransportDeclarationLayer.Service, "worker", "{ run(input: string): number; }"],
            [TransportDeclarationLayer.Offscreen, "document", "{ parse(input: string): boolean; }"],
            [TransportDeclarationLayer.Sandbox, "frame", "{ render(input: string): Promise<string>; }"],
        ] as const) {
            new TransportDeclaration(config, layer).dictionary(populated ? {[name]: signature} : {}).build();
        }

        return ["popup", "sidebar", "icon", "service", "offscreen", "sandbox"]
            .map(name => fs.readFileSync(path.join(directory, ".adnbn", `${name}.d.ts`), "utf8"))
            .join("\n");
    };

    beforeAll(() => {
        rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-shared-registries-"));
        filled = generate(path.join(rootDir, "filled"), true);
        empty = generate(path.join(rootDir, "empty"), false);
    });

    afterAll(() => fs.rmSync(rootDir, {recursive: true, force: true}));

    test("generates registry augmentation without duplicate type aliases or function signatures", () => {
        expect(filled).toContain("interface PopupAliasRegistry");
        expect(filled).toContain("interface SidebarAliasRegistry");
        expect(filled).toContain("interface IconNameRegistry");
        expect(filled).not.toMatch(/export (type|function) /);
        expect(filled).not.toMatch(/\/\/ :(popup-aliases|sidebar-aliases|icon-names)/);
    });

    test.each(
        ["source", "package"].flatMap(mode =>
            ["absent", "empty", "filled", "filled-windows-path"].map(state => ({mode, state}))
        )
    )(
        "checks $mode contracts with $state declarations",
        ({mode, state}) => {
            const config = ts.readConfigFile(path.join(projectDir, "tsconfig.json"), ts.sys.readFile);
            const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectDir);
            expect(config.error).toBeUndefined();
            expect(parsed.errors).toEqual([]);

            const options: ts.CompilerOptions = {
                ...(mode === "source" ? parsed.options : {}),
                module: ts.ModuleKind.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Bundler,
                target: ts.ScriptTarget.ESNext,
                strict: true,
                noEmit: true,
                skipLibCheck: true,
                types: ["node", "chrome"],
            };
            const populated = state.startsWith("filled");
            const rootNames = [path.join(fixtureDir, populated ? "generated.ts" : "fallback.ts")];
            rootNames.push(path.join(fixtureDir, "message.ts"));
            if (populated && mode === "source") rootNames.push(path.join(fixtureDir, "internal.ts"));

            const host = ts.createCompilerHost(options);
            if (state !== "absent") {
                const declaration = populated ? filled : empty;
                const generatedFile = path.join(fixtureDir, "generated.d.ts");
                const generatedPath = state.endsWith("windows-path")
                    ? generatedFile.replace(/\//g, "\\")
                    : generatedFile;
                const getSourceFile = host.getSourceFile.bind(host);
                // Normalize both paths: TypeScript can request forward slashes on Windows.
                host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) =>
                    file.replace(/\\/g, "/") === generatedPath.replace(/\\/g, "/")
                        ? ts.createSourceFile(file, declaration, languageVersion, true)
                        : getSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile);
                rootNames.push(generatedPath);
            }

            const program = ts.createProgram(rootNames, options, host);
            const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => {
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
                const position = diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
                return `${diagnostic.file?.fileName ?? "compiler"}:${(position?.line ?? 0) + 1}: ${message}`;
            });
            expect(diagnostics).toEqual([]);

            const apiFile = ts.resolveModuleName("adnbn", rootNames[0], options, host).resolvedModule?.resolvedFileName;
            expect(apiFile).toBe(
                path.join(projectDir, mode === "source" ? "src/index.ts" : "dist/index.d.ts").replace(/\\/g, "/")
            );
        },
        30_000
    );
});
