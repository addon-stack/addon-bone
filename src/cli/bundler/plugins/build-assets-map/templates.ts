import runtimeTemplate from "./templates/runtime.template.js?raw";
import {renderRuntimeTemplate} from "@cli/bundler/plugins/utils";
import type {RuntimePropertyOptions} from "../types";

interface BuildAssetsRuntimeTemplateOptions extends RuntimePropertyOptions {
    readonly require: string;
    readonly value: string;
    readonly envelope: string;
    readonly full: boolean;
}

export const renderBuildAssetsRuntime = (options: BuildAssetsRuntimeTemplateOptions): string => {
    return renderRuntimeTemplate(runtimeTemplate, {
        __ADNBN_REQUIRE__: options.require,
        __ADNBN_PROPERTY__: JSON.stringify(options.property),
        __ADNBN_VALUE__: JSON.stringify(options.value),
        __ADNBN_ENVELOPE__: JSON.stringify(options.envelope),
        __ADNBN_FULL_MAP__: JSON.stringify(options.full),
    });
};
