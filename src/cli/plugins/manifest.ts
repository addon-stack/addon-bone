import fs from "fs";

import {definePlugin} from "@main/plugin";
import {fromRootPath} from "@cli/workspace";

export default definePlugin(() => {
    return {
        name: "adnbn:manifest",
        manifest: ({config, manifest}) => {
            try {
                const packagePath = fromRootPath(config, "package.json");

                const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf-8"));

                packageJson.manifest && manifest.raw(packageJson.manifest);
            } catch (e) {}

            const configManifest = config.manifest;

            if (typeof configManifest === "object") {
                manifest.raw(configManifest);
            } else if (typeof configManifest === "function") {
                const result = configManifest(manifest);

                result && manifest.raw(result);
            }
        },
    };
});
