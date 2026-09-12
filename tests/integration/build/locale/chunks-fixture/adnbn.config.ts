import {defineConfig} from "adnbn";

export default defineConfig({
    name: "Locale chunks integration",
    version: "1.0.0",
    commonChunks: true,
    concatContentScripts: false,
    jsFilename: "[name].[chunkhash:8].js",
    specific: {gecko: {id: "locale-chunks@adnbn.test"}},
});
