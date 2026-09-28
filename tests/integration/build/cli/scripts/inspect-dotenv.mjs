import path from "node:path";
import {createRequire} from "node:module";
import {rspack} from "@rspack/core";
import {pathToFileURL} from "node:url";

const [modulePath, rootDir, configFile] = process.argv.slice(2);
const {default: resolveConfig} = await import(pathToFileURL(modulePath).href);
const config = await resolveConfig({rootDir, configFile, app: "sample", appSrcDir: "source"});
const plugin = config.plugins.find(plugin => plugin.name === "adnbn:dotenv");
const bundler = plugin.bundler({config});
const {build} = await import(pathToFileURL(path.resolve(modulePath, "../../builders/app/build.js")).href);
const output = path.join(rootDir, "output");
await build(
    rspack({
        mode: "development",
        target: "node",
        entry: path.join(import.meta.dirname, "../fixtures/dotenv/environment.cjs"),
        output: {path: output, filename: "environment.cjs", library: {type: "commonjs2"}},
        plugins: bundler.plugins,
    })
);
const bundled = createRequire(import.meta.url)(path.join(output, "environment.cjs"));
const snapshot = process.env.ADNBN_ENV_CONFIG_SNAPSHOT;
const select = env =>
    Object.fromEntries(
        Object.entries(env).filter(
            ([key]) => key.startsWith("ADNBN_ENV_") || ["APP", "BROWSER", "MODE", "MANIFEST_VERSION"].includes(key)
        )
    );

console.log(
    JSON.stringify({host: select(process.env), bundled, config: snapshot ? select(JSON.parse(snapshot)) : null})
);
