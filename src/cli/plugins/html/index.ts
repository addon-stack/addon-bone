import _ from "lodash";

import {Configuration as RspackConfig, HtmlRspackPlugin} from "@rspack/core";
import HtmlTagsRspackPlugin from "@rspackjs/plugin-html-tags";

import {definePlugin} from "@main/plugin";

export default definePlugin(() => {
    return {
        name: "adnbn:html",
        bundler: ({config, rspack}) => {
            const hasHtml = rspack.plugins?.some(plugin => plugin instanceof HtmlRspackPlugin) ?? false;

            if (!hasHtml) {
                return {};
            }

            const value = _.isFunction(config.html) ? config.html() : config.html;

            if (value === undefined) {
                return {};
            }

            const options = Array.isArray(value) ? value : [value];
            const plugins = options.map(options => new HtmlTagsRspackPlugin(options));

            return {plugins} satisfies RspackConfig;
        },
    };
});
