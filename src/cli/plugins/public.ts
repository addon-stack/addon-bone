import fs from "fs";
import {Configuration as RspackConfig, CopyRspackPlugin} from "@rspack/core";
import {RawCopyPattern} from "@rspack/binding";

import {definePlugin} from "@main/plugin";

import {getAppPath, getAppSourcePath, getSharedPath, getSourcePath} from "@cli/workspace";

type CopyPatterns = Array<Pick<RawCopyPattern, "from" | "to" | "force" | "priority">>;

export default definePlugin(() => {
    return {
        name: "adnbn:public",
        bundler: ({config}) => {
            const {publicDir, mergePublic} = config;

            const patterns: CopyPatterns = [];

            const paths: string[] = [
                getAppSourcePath(config, publicDir),
                getAppPath(config, publicDir),
                getSharedPath(config, publicDir),
                getSourcePath(config, publicDir),
            ];

            for (let i = 0; i < paths.length; i++) {
                if (!mergePublic && patterns.length > 0) break;

                const path = paths[i];

                if (fs.existsSync(path)) {
                    patterns.push({
                        from: path,
                        to: ".",
                        force: true,
                        priority: paths.length - i,
                    });
                }
            }

            if (patterns.length === 0) {
                return {};
            }

            return {
                plugins: [new CopyRspackPlugin({patterns})],
            } satisfies RspackConfig;
        },
    };
});
