import {ViewDefinition, ViewOptions} from "@typing/view";
import {CspOptions} from "@typing/csp";

export interface OptionsConfig {
    /** Open in a browser tab. Defaults to true; embedded mode depends on browser support. */
    openInTab?: boolean;
}

export type OptionsEntrypointOptions = OptionsConfig & CspOptions & ViewOptions;

export type OptionsProps = OptionsEntrypointOptions;

export type OptionsDefinition = OptionsEntrypointOptions & ViewDefinition<OptionsProps>;
