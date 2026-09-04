import cssLoaderTemplate from "./templates/css-loader.template.js?raw";
import runtimeTemplate from "./templates/runtime.template.js?raw";

import {renderRuntimeTemplate} from "@cli/bundler/utils/runtime-template";

interface ShadowStylesRuntimeTemplateOptions {
    readonly entry: string;
    readonly require: string;
    readonly runtimeProperty: string;
    readonly timeout: number;
}

interface ShadowStylesCssLoaderTemplateOptions {
    readonly cssFilenameExpression: string;
    readonly originalRuntime: string;
    readonly publicPath: string;
    readonly require: string;
    readonly runtimeProperty: string;
}

export const renderShadowStylesRuntime = (options: ShadowStylesRuntimeTemplateOptions): string => {
    return renderRuntimeTemplate(runtimeTemplate, {
        __ADNBN_ENTRY__: JSON.stringify(options.entry),
        __ADNBN_REQUIRE__: options.require,
        __ADNBN_RUNTIME_PROPERTY__: options.runtimeProperty,
        __ADNBN_TIMEOUT__: JSON.stringify(options.timeout),
    });
};

export const renderShadowStylesCssLoader = (options: ShadowStylesCssLoaderTemplateOptions): string => {
    return renderRuntimeTemplate(cssLoaderTemplate, {
        __ADNBN_CSS_FILENAME_EXPRESSION__: options.cssFilenameExpression,
        __ADNBN_ORIGINAL_CSS_RUNTIME__: options.originalRuntime,
        __ADNBN_PUBLIC_PATH__: options.publicPath,
        __ADNBN_REQUIRE__: options.require,
        __ADNBN_RUNTIME_PROPERTY__: options.runtimeProperty,
    });
};
