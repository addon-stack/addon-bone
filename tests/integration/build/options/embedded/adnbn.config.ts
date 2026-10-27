import {defineConfig} from "adnbn";
import target from "./manifest-version.json";

export default defineConfig({
    manifestVersion: target.mv2 ? 2 : 3,
    name: "Embedded Options Integration",
    description: "Build fixture preserving explicit openInTab false.",
    version: "1.0.0",
});
