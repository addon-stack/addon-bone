import {createHash} from "node:crypto";
import {mkdirSync} from "node:fs";
import path from "node:path";

// The external virtual-module plugin stores files under cwd/node_modules and removes
// the entire directory on close. Independent project builds must not share it.
export const prepareVirtualModuleDirectory = (context: string, namespace: string): string => {
    const key = createHash("sha256").update(path.resolve(context)).digest("hex");
    const directory = `${namespace}-${key}`;

    // Its existsSync + mkdirSync sequence races when workers share a fresh cwd.
    mkdirSync(path.resolve("node_modules", directory), {recursive: true});

    return directory;
};
