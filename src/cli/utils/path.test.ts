import path from "node:path";

import {toPosix, toPosixPath} from "./path";

test("absolute entrypoint imports preserve their filesystem root", () => {
    const directory = path.resolve("project with spaces", "src");
    const filename = path.join(directory, "newtab.ts");

    expect(toPosix(filename)).toBe(filename.split(path.sep).join("/"));
    expect(toPosixPath(filename)).toBe(path.join(directory, "newtab").split(path.sep).join("/"));
    expect(toPosixPath(path.join(directory, "index.ts"))).toBe(directory.split(path.sep).join("/"));
});

test("relative entrypoint imports keep their directory and index conventions", () => {
    expect(toPosixPath("index.ts")).toBe(".");
    expect(toPosixPath(path.join("src", "newtab.ts"))).toBe("src/newtab");
    expect(toPosixPath(path.join("src", "newtab", "index.ts"))).toBe("src/newtab");
});
