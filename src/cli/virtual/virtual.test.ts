import {execFileSync} from "child_process";
import {existsSync, readFileSync} from "fs";
import path from "path";
import {fileURLToPath} from "url";
import ts from "typescript";
import {build} from "esbuild";

type Generator = keyof typeof import("./index");

describe("Built virtual modules", () => {
    const projectDir = path.resolve(__dirname, "../../..");
    const cases: {generator: Generator; imports: string[]}[] = [
        {
            generator: "virtualBackgroundModule",
            imports: ["adnbn", "adnbn/entry/background", "{entry}"],
        },
        {
            generator: "virtualCommandModule",
            imports: ["adnbn", "adnbn/entry/command", "{entry}"],
        },
        {
            generator: "virtualContentScriptModule",
            imports: ["adnbn/entry/content/{framework}", "{entry}"],
        },
        {
            generator: "virtualServiceModule",
            imports: ["adnbn/transport", "adnbn/entry/transport", "adnbn/entry/service", "{entry}"],
        },
        {
            generator: "virtualOffscreenModule",
            imports: [
                "adnbn",
                "adnbn/transport",
                "adnbn/entry/transport",
                "adnbn/entry/offscreen",
                "adnbn/entry/view/{framework}",
                "{entry}",
            ],
        },
        {
            generator: "virtualOffscreenBackgroundModule",
            imports: ["adnbn/offscreen"],
        },
        {
            generator: "virtualRelayModule",
            imports: ["adnbn/entry/relay", "adnbn/entry/content/{framework}", "{entry}"],
        },
        {
            generator: "virtualSandboxModule",
            imports: [
                "adnbn",
                "adnbn/transport",
                "adnbn/entry/transport",
                "adnbn/entry/sandbox",
                "adnbn/entry/view/{framework}",
                "{entry}",
            ],
        },
        {
            generator: "virtualViewModule",
            imports: ["adnbn", "adnbn/entry/view", "adnbn/entry/view/{framework}", "{entry}"],
        },
    ];
    let generated: Record<"ts" | "tsx", Record<Generator, string>>;
    let navigation: Record<"ts" | "tsx", Record<"virtualContentScriptModule" | "virtualRelayModule", string>>;
    let contentModule: string;

    beforeAll(() => {
        // Run the final JS artifact in Node, without Jest transforms, source aliases, or module mocks.
        const artifacts = JSON.parse(
            execFileSync(
                process.execPath,
                [
                    "--input-type=module",
                    "-e",
                    `
                        import * as generators from "./dist/cli/virtual/index.js";

                        const generated = Object.fromEntries(["ts", "tsx"].map(extension => {
                            const file = {file: "entry." + extension, import: "./entry." + extension};
                            const modules = Object.fromEntries(Object.entries(generators).map(([name, generate]) => {
                                // Content's second argument is navigation, not an entrypoint name.
                                const source = name === "virtualContentScriptModule"
                                    ? generate(file)
                                    : generate(file, "example");
                                return [name, source];
                            }));

                            return [extension, modules];
                        }));

                        const navigation = Object.fromEntries(["ts", "tsx"].map(extension => {
                            const file = {file: "entry." + extension, import: "./entry." + extension};
                            return [extension, {
                                virtualContentScriptModule: generators.virtualContentScriptModule(file, true),
                                virtualRelayModule: generators.virtualRelayModule(file, "example", true),
                            }];
                        }));

                        process.stdout.write(JSON.stringify({
                            generated,
                            navigation,
                            contentModule: import.meta.resolve("adnbn/entry/content"),
                        }));
                    `,
                ],
                {cwd: projectDir, encoding: "utf8", timeout: 10_000}
            )
        );
        generated = artifacts.generated;
        navigation = artifacts.navigation;
        contentModule = artifacts.contentModule;
    });

    test("covers every built generator", () => {
        expect(Object.keys(generated.ts).sort()).toEqual(cases.map(({generator}) => generator).sort());
    });

    test("keeps the entrypoint dependency external with a relative ESM path", () => {
        const source = readFileSync(path.join(projectDir, "dist/cli/virtual/index.js"), "utf8");
        const importedFiles = ts.preProcessFile(source).importedFiles.map(file => file.fileName);

        expect(importedFiles).toContain("../entrypoint/index.js");
    });

    test("resolves the common content entrypoint outside renderer adapters", () => {
        const filename = fileURLToPath(contentModule);
        expect(filename).toBe(path.join(projectDir, "dist/entry/content/index.js"));
        expect(existsSync(filename)).toBe(true);
        expect(existsSync(filename.replace(/\.js$/, ".d.ts"))).toBe(true);
    });

    test.each([
        "adnbn",
        "adnbn/entry/content/vanilla",
        "adnbn/entry/content/react",
        "adnbn/entry/content",
        "adnbn/entry/relay",
    ])("%s includes only its own framework dependencies in the bundle graph", async entrypoint => {
        const result = await build({
            absWorkingDir: projectDir,
            entryPoints: [entrypoint],
            bundle: true,
            platform: "browser",
            format: "esm",
            // Resolve the published package exports instead of the source aliases in tsconfig.json.
            tsconfigRaw: {},
            write: false,
            metafile: true,
            logLevel: "silent",
        });
        const inputs = Object.keys(result.metafile!.inputs).map(filename => filename.replaceAll("\\", "/"));
        const usesReact = entrypoint.endsWith("/react");

        expect(inputs.some(filename => /node_modules\/react\//.test(filename))).toBe(usesReact);
        expect(inputs.some(filename => /node_modules\/react-dom\//.test(filename))).toBe(usesReact);
        expect(inputs.some(filename => filename.includes("entry/content/adapters/react/"))).toBe(usesReact);
        if (entrypoint === "adnbn/entry/relay") {
            expect(inputs.some(filename => filename.includes("entry/content/"))).toBe(false);
        }
        expect(inputs.some(filename => /entry\/content\/adapters\/vanilla\/(Builder|Node)\.js$/.test(filename))).toBe(
            entrypoint.endsWith("/vanilla")
        );
    });

    describe.each([
        {extension: "ts" as const, framework: "vanilla"},
        {extension: "tsx" as const, framework: "react"},
    ])("with $framework entrypoints", ({extension, framework}) => {
        test("loads definition normalization from the selected content entrypoint", () => {
            for (const source of [
                generated[extension].virtualContentScriptModule,
                navigation[extension].virtualContentScriptModule,
            ]) {
                const file = ts.createSourceFile("content.ts", source, ts.ScriptTarget.Latest, true);
                const adapterImport = file.statements.find(ts.isImportDeclaration)!;
                const bindings = adapterImport.importClause?.namedBindings;
                expect(
                    bindings && ts.isNamedImports(bindings) && bindings.elements.map(element => element.name.text)
                ).toEqual(["resolveDefinition"]);
                expect(source).toContain("contentScript(resolveDefinition(module))");
            }
        });

        test("delegates Relay normalization and startup to its runtime entrypoint", () => {
            for (const source of [generated[extension].virtualRelayModule, navigation[extension].virtualRelayModule]) {
                const file = ts.createSourceFile("relay.ts", source, ts.ScriptTarget.Latest, true);
                const relayImport = file.statements.find(ts.isImportDeclaration)!;
                expect((relayImport.moduleSpecifier as ts.StringLiteral).text).toBe("adnbn/entry/relay");
                expect(relayImport.importClause?.name?.text).toBe("relay");
                const bindings = relayImport.importClause?.namedBindings;
                expect(
                    bindings && ts.isNamedImports(bindings) && bindings.elements.map(element => element.name.text)
                ).toEqual(["resolveDefinition"]);
                expect(source).toContain('relay(resolveDefinition(module, "example"), ContentBuilder)');
            }
        });

        test.each(cases)("$generator preserves package imports and resolves placeholders", ({generator, imports}) => {
            const source = generated[extension][generator];
            const importedFiles = ts.preProcessFile(source).importedFiles.map(file => file.fileName);

            expect(importedFiles).toEqual(
                imports.map(specifier =>
                    specifier.replace("{framework}", framework).replace("{entry}", `./entry.${extension}`)
                )
            );
            expect(source).not.toContain("virtual:");
            expect(source).not.toContain(":entry");
        });

        test.each(["virtualContentScriptModule", "virtualRelayModule"] as const)(
            "%s selects the common content builder for document navigation",
            generator => {
                const source = navigation[extension][generator];
                const importedFiles = ts.preProcessFile(source).importedFiles.map(file => file.fileName);
                const {imports} = cases.find(testCase => testCase.generator === generator)!;

                expect(importedFiles).toEqual(
                    imports.map(specifier =>
                        specifier.replace("/{framework}", "").replace("{entry}", `./entry.${extension}`)
                    )
                );
                expect(source).not.toContain("virtual:");
            }
        );
    });
});
