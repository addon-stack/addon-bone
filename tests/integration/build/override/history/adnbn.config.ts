import {defineConfig} from "adnbn";
import target from "./manifest-version.json";

export default defineConfig({
    manifestVersion: target.mv2 ? 2 : 3,
    name: "History Override Integration",
    description: "Build fixture replacing the browser history page.",
    version: "1.0.0",
});
