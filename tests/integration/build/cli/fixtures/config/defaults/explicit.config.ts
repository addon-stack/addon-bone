import {defineConfig} from "adnbn";
import {settings} from "./settings";

export default defineConfig({
    ...settings,
    name: "addon",
    manifestVersion: 3,
    assetsFilename: "[contenthash:4][ext]",
    jsFilename: "[contenthash:5].js",
    cssFilename: "[contenthash:5].css",
    cssIdentName: "[app]-[hash:base64:5]",
});
