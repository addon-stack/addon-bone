import {rm} from "fs/promises";
import {dirname, join} from "path";
import {fileURLToPath} from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

await rm(join(__dirname, "..", "dist"), {force: true, recursive: true});
