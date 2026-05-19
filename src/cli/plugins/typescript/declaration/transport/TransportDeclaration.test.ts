import fs from "fs";
import os from "os";
import path from "path";

import TransportDeclaration, {TransportDeclarationLayer} from "./TransportDeclaration";

import type {ReadonlyConfig} from "@typing/config";

describe("TransportDeclaration", () => {
    const rootDirs: string[] = [];

    const makeRootDir = (): string => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-transport-declaration-"));

        rootDirs.push(rootDir);

        return rootDir;
    };

    afterEach(() => {
        for (const rootDir of rootDirs.splice(0)) {
            fs.rmSync(rootDir, {recursive: true, force: true});
        }
    });

    const cases = [
        {
            dictionary: {
                alpha: "{ call(value: string): Promise<string>; }",
                beta: "{ nested: { ping(): boolean; }; }",
            },
            filename: "offscreen.d.ts",
            layer: TransportDeclarationLayer.Offscreen,
            registry: "OffscreenRegistry",
        },
        {
            dictionary: {
                alpha: "{ call(value: string): Promise<string>; }",
                beta: "{ nested: { ping(): boolean; }; }",
            },
            filename: "service.d.ts",
            layer: TransportDeclarationLayer.Service,
            registry: "ServiceRegistry",
        },
        {
            dictionary: {
                alpha: "{ call(value: string): Promise<string>; }",
                beta: "{ nested: { ping(): boolean; }; }",
            },
            filename: "relay.d.ts",
            layer: TransportDeclarationLayer.Relay,
            registry: "RelayRegistry",
        },
    ];

    test.each(cases)("writes a strict $layer registry", ({dictionary, filename, layer, registry}) => {
        const rootDir = makeRootDir();

        new TransportDeclaration({rootDir} as ReadonlyConfig, layer).dictionary(dictionary).build();

        const declaration = fs.readFileSync(path.join(rootDir, ".adnbn", filename), "utf-8");

        expect(declaration).toContain('import "adnbn";');
        expect(declaration).toContain(`import "adnbn/${layer}";`);
        expect(declaration).not.toContain('import "adnbn/transport";');
        expect(declaration).toContain(`declare module "adnbn/${layer}"`);
        expect(declaration).not.toContain('declare module "adnbn/transport"');
        expect(declaration).toContain(`export interface ${registry}`);
        expect(declaration).toContain("'alpha': { call(value: string): Promise<string>; };");
        expect(declaration).toContain("'beta': { nested: { ping(): boolean; }; };");
        expect(declaration).not.toContain("[name: string]: any");
        expect(declaration).not.toContain("export interface TransportDictionary");
        expect(declaration).not.toContain("export function get");
    });

    test("keeps empty layer registries strict", () => {
        const rootDir = makeRootDir();

        new TransportDeclaration({rootDir} as ReadonlyConfig, TransportDeclarationLayer.Relay).dictionary({}).build();

        const declaration = fs.readFileSync(path.join(rootDir, ".adnbn", "relay.d.ts"), "utf-8");

        expect(declaration).toContain("export interface RelayRegistry");
        expect(declaration).not.toContain("[name: string]: any");
        expect(declaration).not.toContain("__TRANSPORT_DICTIONARY__");
    });
});
