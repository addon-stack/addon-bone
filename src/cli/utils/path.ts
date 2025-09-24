import path from "path";
import _ from "lodash";

export const toPosix = (to: string): string => {
    return path.posix.join(...to.split(path.sep));
};

export const toPosixPath = (pathname: string): string => {
    const {dir, name} = path.parse(pathname);

    return toPosix(name === "index" ? dir : path.join(dir, name));
};

export const isFileExtension = (filename: string, extension: string | string[]): boolean => {
    if (_.isString(extension)) {
        extension = [extension];
    }

    let {ext} = path.parse(filename);

    if (ext.startsWith(".")) {
        ext = ext.slice(1);
    }

    return extension.includes(ext);
};
