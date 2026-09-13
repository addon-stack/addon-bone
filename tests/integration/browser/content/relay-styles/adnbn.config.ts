import {defineConfig} from "adnbn";
export default defineConfig({
    name: "Relay CSS routing",
    version: "1.0.0",
    manifest: {permissions: ["tabs"]},
    specific: {gecko: {id: "relay-styles@adnbn.test"}},
    jsFilename: "[name].[chunkhash:8].js",
    cssFilename: "[name].[contenthash:8].css",
});
