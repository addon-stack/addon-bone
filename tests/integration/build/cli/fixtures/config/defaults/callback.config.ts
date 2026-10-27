import {appendFileSync} from "node:fs";
import path from "node:path";
import {defineConfig} from "adnbn";
import {settings} from "./settings";

export default defineConfig(config => {
    appendFileSync(
        path.join(config.rootDir, "callback-calls.jsonl"),
        JSON.stringify({...config, plugins: config.plugins.map(plugin => plugin.name)}) + "\n"
    );

    return settings;
});
