import {DefinePlugin} from "@rspack/core";

import {definePlugin} from "@main/plugin";
import {filterEnvVars, resolveEnvOptions} from "./utils";

import {defineTopology} from "@cli/utils/topology";

import {type DotenvParseOutput} from "dotenv";

export default definePlugin((vars: DotenvParseOutput = {}) => {
    return {
        name: "adnbn:dotenv",
        // `process.env` is whole-object global substitution — DefinePlugin is the right tool, so it
        // stays baked (NOT a virtual module). Reporting it to the topology snapshot is what makes a
        // `.env` change force a dev-server restart (re-baking the value); without this it goes stale.
        topology: ({config}) => {
            const {filter} = resolveEnvOptions(config.env);

            return {defines: [defineTopology({name: "process.env", value: filterEnvVars(vars, filter)})]};
        },
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
