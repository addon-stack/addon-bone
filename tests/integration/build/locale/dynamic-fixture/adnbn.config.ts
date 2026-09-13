import {defineConfig} from "adnbn";

export default defineConfig({
    name: "Dynamic locale integration",
    version: "1.0.0",
    manifest: {permissions: ["storage"]},
    commonChunks: true,
    concatContentScripts: false,
    jsFilename: "[name].js",
    specific: {gecko: {id: "dynamic-locale@adnbn.test"}},
});
