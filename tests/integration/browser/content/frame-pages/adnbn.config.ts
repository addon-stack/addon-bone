import {defineConfig} from "adnbn";
export default defineConfig({
    name: "Frame page integration",
    version: "1.0.0",
    specific: {gecko: {id: "frame-pages@adnbn.test"}},
    jsFilename: "[name].[contenthash:8].js",
});
