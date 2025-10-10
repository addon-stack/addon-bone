import path from "path";
import _ from "lodash";
import {TsConfigJson} from "type-fest";

import FileBuilder from "./FileBuilder";

import {getResolvePath} from "@cli/resolvers/path";

import {ReadonlyConfig} from "@typing/config";
import {PackageName} from "@typing/app";

export default class extends FileBuilder {
    protected readonly vendorAliases = {
        [`${PackageName}/browser`]: "@addon-core/browser",
        [`${PackageName}/storage`]: "@addon-core/storage",
    };

    public constructor(config: ReadonlyConfig) {
        super(config);
    }

    protected filename(): string {
        return "tsconfig.json";
    }

    protected withBanner(): boolean {
        return false;
    }

    protected template(): string {
        return ""; // Not need is this place
    }

    protected content(): string {
        return JSON.stringify(this.json(), null, 2);
    }

    protected alias(): Record<string, string> {
        const srcDir = this.config.srcDir;
        const sharedDir = path.posix.join(srcDir, this.config.sharedDir);

        return {
            [srcDir]: srcDir,
            "@": srcDir,
            "@shared": sharedDir,
            "~": sharedDir,
        };
    }

    public aliases(): Record<string, string> {
        return _.merge(
            this.vendorAliases,
            _.mapValues(this.alias(), value => getResolvePath(value))
        );
    }

    public paths(): Record<string, string[]> {
        return _.reduce(
            this.alias(),
            (paths, value, key) => ({
                ...paths,
                [path.posix.join(key, "*")]: [path.posix.join("..", value, "*")],
            }),
            {} as Record<string, string[]>
        );
    }

    public json(): TsConfigJson {
        const outputDir = path.posix.join("..", this.config.outDir);

        return {
            compilerOptions: {
                target: "ESNext",
                module: "ESNext",
                moduleResolution: "Bundler",
                esModuleInterop: true,
                forceConsistentCasingInFileNames: true,
                resolveJsonModule: true,
                strict: true,
                skipLibCheck: true,
                noEmit: true,
                outDir: outputDir,
                paths: this.paths(),
            },
            include: ["../**/*", "./*.d.ts"],
            exclude: [outputDir],
        };
    }
}
