import {defineConfig} from "adnbn";

export default defineConfig({
    name: "Content Entrypoint Assets Integration",
    description: "Content runtime coverage for entrypoint assets and dynamic imports in Chrome and Firefox.",
    version: "1.0.0",
    specific: {gecko: {id: "entrypoint-assets@adnbn.test"}},
    concatContentScripts: false,
    jsFilename: "[name].[chunkhash:8].js",
    cssFilename: "[name].[contenthash:8].css",
    assetsFilename: "[name]-[contenthash:4][ext]",
});
