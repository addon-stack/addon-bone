import fs from "fs";
import os from "os";
import path from "path";

import AbstractEntrypointFinder from "./AbstractEntrypointFinder";

import {ReadonlyConfig} from "@typing/config";
import {EntrypointFile, EntrypointOptions, EntrypointParser, EntrypointType} from "@typing/entrypoint";

class TestFinder extends AbstractEntrypointFinder<EntrypointOptions> {
    public constructor() {
        super({
            app: "app",
            appsDir: "apps",
            appSrcDir: ".",
            debug: false,
            rootDir: ".",
            sharedDir: "shared",
            srcDir: "src",
        } as ReadonlyConfig);
    }

    public type(): EntrypointType {
        return EntrypointType.Background;
    }

    public scan(directory: string): Set<EntrypointFile> {
        return this.findFiles(directory);
    }

    protected getParser(): EntrypointParser<EntrypointOptions> {
        return {
            options: () => ({}),
            contract: () => undefined,
        };
    }
}

const createTempDir = (): string => {
    return fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-entrypoint-finder-"));
};

const touch = (file: string): void => {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, "export {};\n");
};

const relativeFiles = (root: string, files: Set<EntrypointFile>): string[] => {
    return Array.from(files, ({file}) => path.relative(root, file)).sort();
};

describe("AbstractEntrypointFinder", () => {
    test("uses grouped entrypoint directory instead of root-level entrypoint files", () => {
        const root = createTempDir();

        try {
            touch(path.join(root, "background.ts"));
            touch(path.join(root, "analytics.background.ts"));
            touch(path.join(root, "backgrounds", "main.background.ts"));
            touch(path.join(root, "backgrounds", "sync.background", "index.ts"));

            const files = new TestFinder().scan(root);

            expect(relativeFiles(root, files)).toEqual([
                "backgrounds/main.background.ts",
                "backgrounds/sync.background/index.ts",
            ]);
        } finally {
            fs.rmSync(root, {force: true, recursive: true});
        }
    });

    test("uses root-level entrypoint files when grouped directory has no entrypoints", () => {
        const root = createTempDir();

        try {
            fs.mkdirSync(path.join(root, "backgrounds"), {recursive: true});
            touch(path.join(root, "background.ts"));
            touch(path.join(root, "analytics.background.ts"));

            const files = new TestFinder().scan(root);

            expect(relativeFiles(root, files)).toEqual(["analytics.background.ts", "background.ts"]);
        } finally {
            fs.rmSync(root, {force: true, recursive: true});
        }
    });

    test("uses singular entrypoint directory when grouped and root-level entrypoints are missing", () => {
        const root = createTempDir();

        try {
            touch(path.join(root, "background", "index.ts"));

            const files = new TestFinder().scan(root);

            expect(relativeFiles(root, files)).toEqual(["background/index.ts"]);
        } finally {
            fs.rmSync(root, {force: true, recursive: true});
        }
    });

    test("uses grouped entrypoint directory instead of singular entrypoint directory", () => {
        const root = createTempDir();

        try {
            touch(path.join(root, "backgrounds", "main.background.ts"));
            touch(path.join(root, "background", "index.ts"));

            const files = new TestFinder().scan(root);

            expect(relativeFiles(root, files)).toEqual(["backgrounds/main.background.ts"]);
        } finally {
            fs.rmSync(root, {force: true, recursive: true});
        }
    });

    test("uses root-level entrypoint directories when grouped directory is missing", () => {
        const root = createTempDir();

        try {
            touch(path.join(root, "analytics.background", "index.ts"));
            touch(path.join(root, "tracking.background", "index.ts"));

            const files = new TestFinder().scan(root);

            expect(relativeFiles(root, files)).toEqual([
                "analytics.background/index.ts",
                "tracking.background/index.ts",
            ]);
        } finally {
            fs.rmSync(root, {force: true, recursive: true});
        }
    });
});
