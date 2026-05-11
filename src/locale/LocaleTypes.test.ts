import path from "path";
import ts from "typescript";

const normalizeDiagnosticFilename = (filename: string): string => {
    return path.normalize(filename).toLowerCase();
};

const typecheck = (source: string): string[] => {
    const filename = path.join(__dirname, "__locale-type-test.ts");
    const normalizedFilename = normalizeDiagnosticFilename(filename);
    const options: ts.CompilerOptions = {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: ts.ScriptTarget.ESNext,
        types: [],
    };

    const host = ts.createCompilerHost(options);
    const getSourceFile = host.getSourceFile.bind(host);
    const readFile = host.readFile.bind(host);
    const fileExists = host.fileExists.bind(host);

    host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => {
        if (file === filename) {
            return ts.createSourceFile(file, source, languageVersion, true);
        }

        return getSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile);
    };

    host.readFile = file => (file === filename ? source : readFile(file));
    host.fileExists = file => file === filename || fileExists(file);

    const program = ts.createProgram([filename], options, host);

    return ts
        .getPreEmitDiagnostics(program)
        .filter(diagnostic => {
            return diagnostic.file && normalizeDiagnosticFilename(diagnostic.file.fileName) === normalizedFilename;
        })
        .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
};

const prelude = `
import type {LocaleNonPluralKeys, LocalePluralKeys, LocaleSubstitutionArgs} from "../types/locale";

interface Structure {
    "app.name": {plural: false; substitutions: []};
    "app.greeting": {plural: false; substitutions: ["name"]};
    "app.cars": {plural: true; substitutions: ["count"]};
}

declare function trans<K extends LocaleNonPluralKeys<Structure>>(
    key: K,
    ...args: LocaleSubstitutionArgs<Structure, K>
): string;

declare function choice<K extends LocalePluralKeys<Structure>>(
    key: K,
    count: number,
    ...args: LocaleSubstitutionArgs<Structure, K>
): string;
`;

describe("locale types", () => {
    test("accept valid locale calls", () => {
        expect(
            typecheck(`
${prelude}

trans("app.name");
trans("app.greeting", {name: "Alice"});
choice("app.cars", 2, {count: 2});
`)
        ).toEqual([]);
    });

    test("reject substitutions for keys without placeholders", () => {
        const diagnostics = typecheck(`
${prelude}

trans("app.name", {name: "Alice"});
`).join("\n");

        expect(diagnostics).toMatch("Expected 1 arguments, but got 2.");
    });

    test("require all substitutions for keys with placeholders", () => {
        const diagnostics = typecheck(`
${prelude}

trans("app.greeting");
trans("app.greeting", {});
`).join("\n");

        expect(diagnostics).toMatch("Expected 2 arguments, but got 1.");
        expect(diagnostics).toMatch("Property 'name' is missing");
    });

    test("reject unknown substitution keys", () => {
        const diagnostics = typecheck(`
${prelude}

trans("app.greeting", {name: "Alice", extra: "bad"});
`).join("\n");

        expect(diagnostics).toMatch("'extra' does not exist");
    });

    test("keeps plural and non-plural locale keys separate", () => {
        const diagnostics = typecheck(`
${prelude}

trans("app.cars", {count: 2});
choice("app.greeting", 1, {name: "Alice"});
`).join("\n");

        expect(diagnostics).toMatch("Argument of type '\"app.cars\"' is not assignable");
        expect(diagnostics).toMatch("Argument of type '\"app.greeting\"' is not assignable");
    });
});
