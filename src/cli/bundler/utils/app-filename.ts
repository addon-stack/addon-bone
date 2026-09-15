import type {Filename} from "@rspack/core";
import _ from "lodash";
import path from "path";

export const appFilenameResolver = (app: string, filename: Filename, dirname?: string): Filename => {
    app = _.kebabCase(app);

    const resolve = (name: string): string => {
        name = name.replaceAll("[app]", app);

        return dirname ? path.posix.join(dirname, name) : name;
    };

    if (!_.isFunction(filename)) {
        return resolve(filename);
    }

    return (pathData, assetInfo): string => {
        return resolve(filename(pathData, assetInfo));
    };
};
