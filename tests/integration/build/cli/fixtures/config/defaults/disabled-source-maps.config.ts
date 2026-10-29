import {defineConfig} from "adnbn";
import {settings} from "./settings";

export default defineConfig({
    ...settings,
    plugins: [
        {
            name: "disable-source-maps",
            bundler: () => ({devtool: false}),
        },
    ],
});
