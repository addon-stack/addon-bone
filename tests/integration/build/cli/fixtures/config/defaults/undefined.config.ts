import {defineConfig} from "adnbn";
import {settings} from "./settings";

export default defineConfig({
    ...settings,
    name: undefined,
    manifestVersion: undefined,
    assetsFilename: undefined,
    jsFilename: undefined,
    cssFilename: undefined,
    cssIdentName: undefined,
});
