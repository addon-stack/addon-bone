import {pathToFileURL} from "node:url";

const [modulePath, rootDir, configFile, options] = process.argv.slice(2);
const {default: resolveConfig} = await import(pathToFileURL(modulePath).href);
const config = await resolveConfig({...JSON.parse(options), rootDir, configFile});

console.log(JSON.stringify({...config, plugins: config.plugins.map(plugin => plugin.name)}));
