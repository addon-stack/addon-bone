import type {HtmlOptions} from "adnbn";

export const htmlOptions: HtmlOptions = {
    files: ["**/object.html"],
    metas: [{attributes: {name: "global-meta", content: "global"}}],
    scripts: {
        path: "global.js",
        sourcePath: "assets/global.js",
        publicPath: (assetPath, publicPath) => {
            if (assetPath !== "global.js" || typeof publicPath !== "string") {
                throw new Error("Unexpected publicPath callback arguments");
            }

            return `/global/${assetPath}`;
        },
    },
    hash: (assetPath, hash) => {
        if (assetPath !== "/global/global.js" || typeof hash !== "string" || hash.length === 0) {
            throw new Error("Unexpected hash callback arguments");
        }

        return `${assetPath}?build=${hash}`;
    },
};
