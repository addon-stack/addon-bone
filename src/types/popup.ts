import {ViewDefinition, ViewOptions} from "@typing/view";
import {CspOptions} from "@typing/csp";

export interface PopupConfig {
    icon?: string;
    apply?: boolean;
}

export type PopupEntrypointOptions = PopupConfig & CspOptions & ViewOptions;

export type PopupProps = PopupEntrypointOptions;

export type PopupDefinition = PopupEntrypointOptions & ViewDefinition<PopupProps>;
