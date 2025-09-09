import _ from "lodash";
import fs from "fs";
import {fileURLToPath} from "url";

export const toPath = (p: string | URL): string => (_.isString(p) ? p : fileURLToPath(p));

export const isFile = (pathAbs: undefined | null | string | URL): pathAbs is string => {
    if (!_.isString(pathAbs) || pathAbs.length === 0) {
        return false;
    }

    try {
        return fs.statSync(toPath(pathAbs)).isFile();
    } catch {
        return false;
    }
};

export const isDirectory = (pathAbs: undefined | null | string | URL): pathAbs is string => {
    if (!_.isString(pathAbs) || pathAbs.length === 0) {
        return false;
    }

    try {
        return fs.statSync(toPath(pathAbs)).isDirectory();
    } catch {
        return false;
    }
};
