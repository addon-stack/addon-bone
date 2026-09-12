import fs from "fs";
import os from "os";
import path from "path";
import ts from "typescript";

import LocaleDeclaration from "./LocaleDeclaration";
import type {ReadonlyConfig} from "@typing/config";
import type {LocaleStructure} from "@typing/locale";

const fixtureDirectory = path.join(__dirname, "tests/fixtures");

const typecheck = (files: string[], declaration?: string, target: "source" | "package" = "package"): string[] => {
    const config = ts.readConfigFile(path.join(ADNBN_TEST_ROOT, "tsconfig.json"), ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ADNBN_TEST_ROOT);
    expect(config.error).toBeUndefined();
    expect(parsed.errors).toEqual([]);
    const options: ts.CompilerOptions = {
        ...(target === "source" ? parsed.options : {}),
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ESNext,
        strict: true,
        skipLibCheck: target === "source",
        jsx: ts.JsxEmit.ReactJSX,
        noEmit: true,
        types: [],
        paths:
            target === "source"
                ? parsed.options.paths
                : {
                      "adnbn/locale": [path.join(ADNBN_TEST_ROOT, "dist/locale/index.d.ts")],
                      "adnbn/locale/react": [path.join(ADNBN_TEST_ROOT, "dist/locale/adapters/react/index.d.ts")],
                  },
    };
    const rootNames = files.map(file => path.join(fixtureDirectory, file));
    if (declaration) rootNames.push(declaration);
    const program = ts.createProgram(rootNames, options);

    return ts.getPreEmitDiagnostics(program).map(diagnostic => {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
        const position = diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
        return `${diagnostic.file?.fileName ?? "compiler"}:${(position?.line ?? 0) + 1}: ${message}`;
    });
};

describe("locale declarations", () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-locale-declaration-"));
    });

    afterEach(() => {
        fs.rmSync(root, {recursive: true, force: true});
    });

    const generate = (structure: LocaleStructure): string => {
        new LocaleDeclaration({rootDir: root} as ReadonlyConfig).structure(structure).build();

        return path.join(root, ".adnbn/locale.d.ts");
    };

    test("generates only the app registry, without duplicating runtime or React APIs", () => {
        const declaration = generate({"app.title": {plural: false, substitutions: []}});
        const content = fs.readFileSync(declaration, "utf8");

        expect(content).toContain('import "adnbn/locale";');
        expect(content).toContain('declare module "adnbn/locale"');
        expect(content).toContain("export interface LocaleRegistry");
        expect(content).toContain('"app.title"');
        expect(content).not.toContain("__LOCALE_DICTIONARY__");
        expect(content).not.toContain("GeneratedNativeStructure");
        expect(content).not.toContain("extends LocaleStructure");
        expect(content).not.toContain("[key: string]");
        expect(content).not.toContain("export function");
        expect(content).not.toContain("class ");
        expect(content).not.toContain("LocaleReactContract");
        expect(content).not.toContain("langNames");
        expect(content).not.toContain("langs");
        expect(content).not.toContain("adnbn/locale/react");
    });

    describe.each(["source", "package"] as const)("%s types", target => {
        test("keep an absent registry strict and allow explicit custom structures", () => {
            expect(
                typecheck(["language-names.ts", "empty-registry.ts", "custom-structure.ts"], undefined, target)
            ).toEqual([]);
        });

        test("keep an empty generated registry strict", () => {
            const declaration = generate({});

            expect(typecheck(["language-names.ts", "empty-registry.ts"], declaration, target)).toEqual([]);
        });

        test("derive every API from the generated registry", () => {
            const declaration = generate({
                "app.title": {plural: false, substitutions: []},
                "app.greeting": {plural: false, substitutions: ["name"]},
                "cart.items": {plural: true, substitutions: ["count"]},
                "cart.empty": {plural: true, substitutions: []},
            });

            expect(
                typecheck(
                    [
                        "language-names.ts",
                        "custom-structure.ts",
                        "generated-registry.ts",
                        "native-react.tsx",
                        "dynamic-react.tsx",
                    ],
                    declaration,
                    target
                )
            ).toEqual([]);
        });
    });
});
