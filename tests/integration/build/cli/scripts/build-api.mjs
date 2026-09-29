import {readFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

const [modulePath, rootDir, outputPath] = process.argv.slice(2);
const {default: app} = await import(pathToFileURL(modulePath).href);
const stats = await app({command: "build", rootDir, app: "exit-code", browser: "chrome"});

if (!stats || stats.hasErrors()) {
    throw new Error("Expected successful build statistics");
}

const marker = await readFile(path.join(outputPath, "compiler-closed.txt"), "utf8");

if (marker !== "closed") {
    throw new Error("Build resolved before compiler shutdown");
}

console.log("Build API resolved after shutdown");
