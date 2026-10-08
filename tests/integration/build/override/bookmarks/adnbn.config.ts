import {defineConfig} from "adnbn";
import target from "./manifest-version.json";

export default defineConfig({
    manifestVersion: target.mv2 ? 2 : 3,
    name: "Bookmarks Override Integration",
    description: "Build fixture replacing the browser bookmarks page.",
    version: "1.0.0",
});
