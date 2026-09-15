import {defineConfig} from "adnbn";

export default defineConfig({
    name: "Content render props",
    version: "1.0.0",
    manifest: {permissions: ["tabs"]},
    specific: {gecko: {id: "render-props@adnbn.test"}},
});
