import {readdir} from "fs/promises";
import path from "path";

const TestPathSegments = new Set(["tests", "__tests__", "__mocks__"]);

const collectPaths = async (directory: string): Promise<string[]> => {
    const entries = await readdir(directory, {withFileTypes: true});
    const paths: string[] = [];

    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        paths.push(entryPath);

        if (entry.isDirectory()) {
            paths.push(...(await collectPaths(entryPath)));
        }
    }

    return paths;
};

describe("build output", () => {
    test("excludes test files and directories", async () => {
        const output = path.resolve(process.cwd(), "dist");
        const paths = await collectPaths(output);
        const testPaths = paths.filter(outputPath => {
            const relativePath = path.relative(output, outputPath);
            const segments = relativePath.split(path.sep);

            return (
                segments.some(segment => TestPathSegments.has(segment)) || /\.(?:test|spec)\.[^.]+$/.test(relativePath)
            );
        });

        expect(testPaths).toEqual([]);
    });
});
