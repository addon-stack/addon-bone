import type {HtmlOptions} from "adnbn";

export const htmlOptions: HtmlOptions = {
    files: ["**/object.html"],
    metas: [{attributes: {name: "global-meta", content: "global"}}],
    scripts: {
        path: "global.js",
        sourcePath: "assets/global.js",
        publicPath: assetPath => `/global/${assetPath}`,
    },
    hash: (assetPath, hash) => `${assetPath}?build=${hash}`,
};
