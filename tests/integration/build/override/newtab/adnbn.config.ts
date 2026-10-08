import {defineConfig} from "adnbn";
import target from "./manifest-version.json";

export default defineConfig({
    manifestVersion: target.mv2 ? 2 : 3,
    name: "New Tab Override Integration",
    description: "Build fixture replacing the browser new tab page.",
    version: "1.0.0",
});
