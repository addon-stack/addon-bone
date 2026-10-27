import type {HtmlOptions} from "adnbn";

export const htmlOptions: HtmlOptions = {
    scripts: "extra.js",
    hash: () => {
        throw new Error("HTML hash callback failed");
    },
};
