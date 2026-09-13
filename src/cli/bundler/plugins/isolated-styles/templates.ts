import cssLoaderTemplate from "./templates/css-loader.template.js?raw";
import runtimeTemplate from "./templates/runtime.template.js?raw";

import {renderRuntimeTemplate} from "@cli/bundler/plugins/utils";
import type {RuntimePropertyOptions} from "../types";

interface IsolatedStylesRuntimeTemplateOptions extends RuntimePropertyOptions {
    readonly entry: string;
    readonly require: string;
    readonly timeout: number;
    readonly initialStyles: readonly string[];
}

interface IsolatedStylesCssLoaderTemplateOptions extends RuntimePropertyOptions {
    readonly isolatedChunks: Readonly<Record<string, boolean>>;
    readonly originalLoader: string;
    readonly cssFilenameExpression: string;
    readonly originalRuntime: string;
    readonly publicPath: string;
    readonly require: string;
}

export const renderIsolatedStylesRuntime = (options: IsolatedStylesRuntimeTemplateOptions): string => {
    return renderRuntimeTemplate(runtimeTemplate, {
        __ADNBN_ENTRY__: JSON.stringify(options.entry),
        __ADNBN_REQUIRE__: options.require,
        __ADNBN_PROPERTY__: JSON.stringify(options.property),
        __ADNBN_TIMEOUT__: JSON.stringify(options.timeout),
        __ADNBN_INITIAL_STYLES__: JSON.stringify(options.initialStyles),
    });
};

export const renderIsolatedStylesCssLoader = (options: IsolatedStylesCssLoaderTemplateOptions): string => {
    return renderRuntimeTemplate(cssLoaderTemplate, {
        __ADNBN_ISOLATED_CSS_CHUNKS__: JSON.stringify(options.isolatedChunks),
        __ADNBN_ORIGINAL_CSS_LOADER__: options.originalLoader,
        __ADNBN_CSS_FILENAME_EXPRESSION__: options.cssFilenameExpression,
        __ADNBN_ORIGINAL_CSS_RUNTIME__: options.originalRuntime,
        __ADNBN_PUBLIC_PATH__: options.publicPath,
        __ADNBN_REQUIRE__: options.require,
        __ADNBN_PROPERTY__: JSON.stringify(options.property),
    });
};
