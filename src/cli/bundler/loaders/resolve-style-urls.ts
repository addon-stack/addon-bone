import type {LoaderDefinition} from "@rspack/core";
import resolveUrlLoader from "resolve-url-loader";

/** Cooperate with plugins that already install resolve-url-loader in this resource's chain. */
const resolveStyleUrls: LoaderDefinition = function (content, sourceMap, metadata) {
    const existing = this.loaders.some(
        (loader, index) => index !== this.loaderIndex && /(?:^|[/\\])resolve-url-loader(?:[/\\]|$)/.test(loader.path)
    );

    if (existing) {
        this.callback(null, content, sourceMap, metadata);

        return;
    }

    return resolveUrlLoader.call(this, content, sourceMap);
};

export default resolveStyleUrls;
