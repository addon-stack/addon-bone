import {execFileSync} from "child_process";
import path from "path";
import ts from "typescript";

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
            imports: ["adnbn", "adnbn/locale", "adnbn/entry/command", "{entry}"],
        },
        {
            generator: "virtualContentScriptModule",
            imports: ["adnbn", "adnbn/entry/content", "adnbn/entry/content/{framework}", "{entry}"],
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
            imports: [
                "adnbn/transport",
                "adnbn/entry/transport",
                "adnbn/entry/relay",
                "adnbn/entry/content/{framework}",
                "{entry}",
            ],
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
            imports: ["adnbn", "adnbn/locale", "adnbn/entry/view", "adnbn/entry/view/{framework}", "{entry}"],
        },
    ];
    let generated: Record<"ts" | "tsx", Record<Generator, string>>;

    beforeAll(() => {
        // Run the final JS artifact in Node, without Jest transforms, source aliases, or module mocks.
        generated = JSON.parse(
            execFileSync(
                process.execPath,
                [
                    "--input-type=module",
                    "-e",
                    `
                        import * as generators from "./dist/cli/virtual/index.js";

                        const generated = Object.fromEntries(["ts", "tsx"].map(extension => {
                            const file = {file: "entry." + extension, import: "./entry." + extension};
                            const modules = Object.fromEntries(Object.entries(generators).map(([name, generate]) =>
                                [name, generate(file, "example")]
                            ));

                            return [extension, modules];
                        }));

                        process.stdout.write(JSON.stringify(generated));
                    `,
                ],
                {cwd: projectDir, encoding: "utf8", timeout: 10_000}
            )
        );
    });

    test("covers every built generator", () => {
        expect(Object.keys(generated.ts).sort()).toEqual(cases.map(({generator}) => generator).sort());
    });

    describe.each([
        {extension: "ts" as const, framework: "vanilla"},
        {extension: "tsx" as const, framework: "react"},
    ])("with $framework entrypoints", ({extension, framework}) => {
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
    });
});
