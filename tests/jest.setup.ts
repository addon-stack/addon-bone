import path from "node:path";
import {legacyFiles} from "./browser-harness/migration.json";

// Temporary migration boundary. A file uses exactly one browser implementation.
const testFile = path.relative(path.resolve(__dirname, ".."), expect.getState().testPath!).split(path.sep).join("/");

if (legacyFiles.includes(testFile)) {
    require("./jest-legacy.setup");
} else {
    require("./jest-browser.setup");
}
