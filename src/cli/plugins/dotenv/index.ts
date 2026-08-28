import {DefinePlugin} from "@rspack/core";

import {definePlugin} from "@main/plugin";
import {filterEnvVars, resolveEnvOptions} from "./utils";

import {type DotenvParseOutput} from "dotenv";

export default definePlugin((vars: DotenvParseOutput = {}) => {
    return {
        name: "adnbn:dotenv",
        bundler: ({config}) => {
            const {filter} = resolveEnvOptions(config.env);

            const data = filterEnvVars(vars, filter);

            return {
                plugins: [
                    new DefinePlugin({
                        "process.env": JSON.stringify(data),
                    }),
                ],
            };
        },
    };
});
