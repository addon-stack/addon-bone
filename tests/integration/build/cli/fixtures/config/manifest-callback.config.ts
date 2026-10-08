import path from "node:path";
import {defineConfig} from "adnbn";

export default defineConfig({
    version: "1.2.3",
    srcDir: path.join("defaults", "src"),
    manifest(builder) {
        builder.getWebAccessibleResources();

        return {version_name: "1.2 beta"};
    },
});
