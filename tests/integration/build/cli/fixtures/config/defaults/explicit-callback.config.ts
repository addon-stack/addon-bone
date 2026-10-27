import {defineConfig} from "adnbn";
import {settings} from "./settings";

export default defineConfig(config => ({...config, ...settings}));
