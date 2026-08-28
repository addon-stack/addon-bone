import fs from "fs";
import os from "os";
import path from "path";
import ts from "typescript";

import LocaleDeclaration from "./LocaleDeclaration";
import {ReadonlyConfig} from "@typing/config";
import {LocaleStructure} from "@typing/locale";

const packageRoot = path.resolve(__dirname, "../../../../..");

const normalizeFilename = (filename: string): string => path.normalize(filename).replaceAll("\\", "/").toLowerCase();

const typecheck = (source: string, declaration?: string, target: "source" | "package" = "package"): string[] => {
    const filename = path.join(packageRoot, "__locale-consumer-test.ts");
    const isTestFile = (file: string): boolean => normalizeFilename(file) === normalizeFilename(filename);
    const config = ts.readConfigFile(path.join(packageRoot, "tsconfig.json"), ts.sys.readFile);
    const sourceOptions = ts.parseJsonConfigFileContent(config.config, ts.sys, packageRoot).options;
    const options: ts.CompilerOptions = {
        ...(target === "source" ? sourceOptions : {}),
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ESNext,
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        types: [],
        paths:
            target === "source"
                ? sourceOptions.paths
                : {
                      "adnbn/locale": [path.join(packageRoot, "dist/locale/index.d.ts")],
                      "adnbn/locale/react": [path.join(packageRoot, "dist/locale/adapters/react/index.d.ts")],
                  },
    };
    const host = ts.createCompilerHost(options);
    const getSourceFile = host.getSourceFile.bind(host);
    const readFile = host.readFile.bind(host);
    const fileExists = host.fileExists.bind(host);

    host.getSourceFile = (file, version, onError, createNew) =>
        isTestFile(file)
            ? ts.createSourceFile(file, source, version, true)
            : getSourceFile(file, version, onError, createNew);
    host.readFile = file => (isTestFile(file) ? source : readFile(file));
    host.fileExists = file => isTestFile(file) || fileExists(file);

    const program = ts.createProgram(declaration ? [filename, declaration] : [filename], options, host);

    return ts
        .getPreEmitDiagnostics(program)
        .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
};

const namesUsage = `
import {Language, NativeLocale, DynamicLocale, type LocaleProvider} from "adnbn/locale";
import {useLocale} from "adnbn/locale/react";

const native: Map<Language, string> = new NativeLocale().languageNames();
const dynamic: Map<Language, string> = new DynamicLocale().languageNames();
declare const provider: LocaleProvider<{}>;
const providerNames: Map<Language, string> = provider.languageNames();
const available: Set<Language> = new NativeLocale().languages();
const names: ReadonlyMap<Language, string> = useLocale().langs;
const title: string | undefined = names.get(Language.French);
// @ts-expect-error React exposes a read-only map
useLocale().langs.set(Language.French, "Changed");
// @ts-expect-error only providers retain the languageNames method
useLocale().languageNames;
// @ts-expect-error keys are Language values, not arbitrary strings
native.get("unsupported");
`;

const emptyRegistryUsage = `
import {t, choice, key, resolve, type LocaleNativeStructure} from "adnbn/locale";

const emptyKeys: ReadonlySet<never> = new NativeLocale().keys();
const emptyDynamicKeys: ReadonlySet<never> = new DynamicLocale(false).keys();
const plain: string = resolve("Plain title");
declare const runtimeMarker: string;
resolve(runtimeMarker);
// @ts-expect-error an empty registry has no keys
const missing: keyof LocaleNativeStructure = "app.title";
// @ts-expect-error no generated non-plural keys
t("app.title");
// @ts-expect-error no generated plural keys
choice("cart.items", 2);
// @ts-expect-error marker keys are also restricted by the registry
key("app.title");
// @ts-expect-error native providers share the empty registry
new NativeLocale().trans("app.title");
// @ts-expect-error the singleton shares the empty registry
NativeLocale.getInstance().trans("app.title");
// @ts-expect-error dynamic providers share the empty registry
new DynamicLocale(false).choice("cart.items", 2);
// @ts-expect-error React shares the empty registry
useLocale().t("app.title");
`;

const customStructureUsage = `
import type {LocaleContract} from "adnbn/locale/react";

interface CustomStructure {
    custom: {plural: false; substitutions: ["value"]};
    total: {plural: true; substitutions: []};
}

new NativeLocale<CustomStructure>().trans("custom", {value: "Custom"});
new DynamicLocale<CustomStructure>(false).choice("total", 2);
declare const customContext: LocaleContract<CustomStructure>;
customContext.t("custom", {value: 1});
// @ts-expect-error explicit structures keep their own key contract
new NativeLocale<CustomStructure>().trans("app.title");
// @ts-expect-error explicit structures still require substitutions
new DynamicLocale<CustomStructure>(false).trans("custom");
// @ts-expect-error custom React contracts also keep plural keys separate
customContext.t("total");
`;

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
        expect(content).toContain("export interface LocaleNativeStructure");
        expect(content).toContain('"app.title"');
        expect(content).not.toContain("__LOCALE_DICTIONARY__");
        expect(content).not.toContain("GeneratedNativeStructure");
        expect(content).not.toContain("extends LocaleStructure");
        expect(content).not.toContain("[key: string]");
        expect(content).not.toContain("export function");
        expect(content).not.toContain("class ");
        expect(content).not.toContain("LocaleContract");
        expect(content).not.toContain("languageNames");
        expect(content).not.toContain("langs");
        expect(content).not.toContain("adnbn/locale/react");
    });

    describe.each(["source", "package"] as const)("%s types", target => {
        test("keep an absent registry strict and allow explicit custom structures", () => {
            expect(typecheck(namesUsage + emptyRegistryUsage + customStructureUsage, undefined, target)).toEqual([]);
        });

        test("keep an empty generated registry strict", () => {
            const declaration = generate({});

            expect(typecheck(namesUsage + emptyRegistryUsage, declaration, target)).toEqual([]);
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
                    namesUsage +
                        customStructureUsage +
                        `
import {t, choice, key, resolve, type LocaleNativeStructure} from "adnbn/locale";

t("app.title");
t("app.greeting", {name: "Ada"});
choice("cart.items", 2, {count: 2});
choice("cart.empty", 0);
key("app.title");
key("cart.items");
resolve("@app.title");
resolve("Plain title");
const nativeLocale = new NativeLocale();
nativeLocale.trans("app.greeting", {name: "Ada"});
nativeLocale.choice("cart.items", 2, {count: 2});
NativeLocale.getInstance().trans("app.title");
NativeLocale.getInstance().choice("cart.empty", 0);
const dynamicLocale = new DynamicLocale(false);
dynamicLocale.trans("app.title");
dynamicLocale.choice("cart.items", 2, {count: 2});
dynamicLocale.change(Language.French);
const synced: Promise<Language> = dynamicLocale.sync();
const unwatch: () => void = dynamicLocale.watch(lang => {});
dynamicLocale.unwatch();
useLocale().t("app.greeting", {name: "Ada"});
useLocale().choice("cart.items", 2, {count: 2});
useLocale().change(Language.French);
const allKeys: ReadonlySet<"app.title" | "app.greeting" | "cart.items" | "cart.empty"> = nativeLocale.keys();
const knownKey: keyof LocaleNativeStructure = "app.title";
// @ts-expect-error no index signature widens the registry
const arbitraryKey: keyof LocaleNativeStructure = "extra";
// @ts-expect-error a secondary-only key must not enter the default contract
t("extra");
// @ts-expect-error substitutions remain mandatory
t("app.greeting");
// @ts-expect-error substitutions must contain every declared placeholder
t("app.greeting", {});
// @ts-expect-error unknown substitutions are rejected
t("app.greeting", {name: "Ada", extra: "bad"});
// @ts-expect-error substitution values must be strings or numbers
t("app.greeting", {name: true});
// @ts-expect-error keys without placeholders reject substitutions
t("app.title", {});
// @ts-expect-error plural keys cannot be translated as ordinary keys
t("cart.items");
// @ts-expect-error ordinary keys cannot be used as plural keys
choice("app.title", 2);
// @ts-expect-error plural substitutions remain mandatory
choice("cart.items", 2);
// @ts-expect-error plural keys without placeholders reject substitutions
choice("cart.empty", 2, {});
// @ts-expect-error marker keys share the registry
key("extra");
// @ts-expect-error native providers retain the key contract
nativeLocale.trans("extra");
// @ts-expect-error native providers retain the substitution contract
nativeLocale.trans("app.greeting");
// @ts-expect-error the singleton retains the substitution contract
NativeLocale.getInstance().choice("cart.items", 2);
// @ts-expect-error dynamic providers retain the key contract
dynamicLocale.trans("extra");
// @ts-expect-error dynamic providers retain the substitution contract
dynamicLocale.choice("cart.items", 2);
// @ts-expect-error React retains the generated key contract
useLocale().t("extra");
// @ts-expect-error React retains the substitution contract
useLocale().t("app.greeting");
// @ts-expect-error React retains the plural contract
useLocale().choice("app.title", 2);
`,
                    declaration,
                    target
                )
            ).toEqual([]);
        });
    });
});
