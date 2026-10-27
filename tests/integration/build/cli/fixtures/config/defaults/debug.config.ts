import path from "node:path";
import {defineConfig} from "adnbn";

export default defineConfig({app: "reader", debug: true, version: "1.2.3", srcDir: path.join("defaults", "src")});
