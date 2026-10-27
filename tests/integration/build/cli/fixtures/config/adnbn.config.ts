import {writeFileSync} from "node:fs";
import path from "node:path";
import {Browser, defineConfig} from "adnbn";

export default defineConfig(config => {
    const name = config.browser === Browser.Firefox ? "My Extension for Firefox" : "My Extension";

    writeFileSync(
        path.join(config.rootDir, "callback-input.json"),
        JSON.stringify({...config, plugins: config.plugins.map(plugin => plugin.name)})
    );

    return {
        name,
        version: "1.2.3",
        lang: "fr",
        plugins: [
            {
                name: "config-fixture",
                startup({config}) {
                    writeFileSync(
                        path.join(config.rootDir, "user-plugin.json"),
                        JSON.stringify({name: config.name, browser: config.browser})
                    );
                },
            },
        ],
    };
});
