import fs from "fs";
import os from "os";
import path from "path";

import AbstractEntrypointFinder from "./AbstractEntrypointFinder";
import {toPosix} from "@cli/utils/path";

import {ReadonlyConfig} from "@typing/config";
import {EntrypointFile, EntrypointOptions, EntrypointParser, EntrypointType} from "@typing/entrypoint";

interface TestFinderOptions {
    grouped?: boolean;
    type?: EntrypointType;
}

class TestFinder extends AbstractEntrypointFinder<EntrypointOptions> {
    public constructor(
        config: Partial<ReadonlyConfig> = {},
        private readonly settings: TestFinderOptions = {}
    ) {
        super({
            app: "app",
            appsDir: "apps",
            appSrcDir: ".",
            debug: false,
            rootDir: ".",
            sharedDir: "shared",
            srcDir: "src",
            ...config,
        } as ReadonlyConfig);
    }

    public type(): EntrypointType {
        return this.settings.type ?? EntrypointType.Background;
    }

    protected allowGroupedDirectories(): boolean {
        return this.settings.grouped ?? true;
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
    return Array.from(files, ({file}) => toPosix(path.relative(root, file))).sort();
};

const fixtures = path.resolve(__dirname, "tests", "fixtures", "discovery");

describe("AbstractEntrypointFinder", () => {
    test.each([
        {grouped: true, expected: ["popups/main.popup.ts", "popups/named.popup/index.ts"]},
        {grouped: false, expected: ["popup.ts", "popup/index.ts"]},
    ])("applies grouped directory policy $grouped before choosing root candidates", async ({grouped, expected}) => {
        const rootDir = path.join(fixtures, "grouped");
        const finder = new TestFinder({rootDir, sharedDir: "."}, {grouped, type: EntrypointType.Popup});

        expect(relativeFiles(path.join(rootDir, "src"), await finder.files())).toEqual(expected);
    });

    test.each([true, false])("applies grouped directory policy %s to the nested fallback", async grouped => {
        const rootDir = path.join(fixtures, "fallback");
        const finder = new TestFinder({rootDir, sharedDir: "."}, {grouped});

        expect(relativeFiles(path.join(rootDir, "src"), await finder.files())).toEqual(
            grouped ? ["background/background.ts"] : []
        );
    });

    test("keeps TS, TSX, JS and JSX across the four root layouts when grouping is disabled", async () => {
        const rootDir = path.join(fixtures, "extensions");
        const finder = new TestFinder({rootDir, sharedDir: "."}, {grouped: false, type: EntrypointType.Options});

        expect(relativeFiles(path.join(rootDir, "src"), await finder.files())).toEqual([
            "named.options.js",
            "named.options/index.jsx",
            "options.ts",
            "options/index.tsx",
        ]);
    });

    test("ignores nested files and index directories when grouping is disabled", async () => {
        const finder = new TestFinder(
            {rootDir: path.join(fixtures, "nested"), sharedDir: "."},
            {grouped: false, type: EntrypointType.Options}
        );

        await expect(finder.files()).resolves.toEqual(new Set());
    });

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
