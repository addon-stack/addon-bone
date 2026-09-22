import {ViewDefinition, ViewOptions} from "@typing/view";
import {CspOptions} from "@typing/csp";
import {PermissionsOptions} from "@typing/permissions";

export interface OptionsConfig {
    /** Open in a browser tab. Defaults to true; embedded mode depends on browser support. */
    openInTab?: boolean;
}

export type OptionsEntrypointOptions = OptionsConfig & PermissionsOptions & CspOptions & ViewOptions;

export type OptionsProps = OptionsEntrypointOptions;

export type OptionsDefinition = OptionsEntrypointOptions & ViewDefinition<OptionsProps>;
