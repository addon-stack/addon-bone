import {ViewDefinition, ViewOptions} from "@typing/view";
import {CspOptions} from "@typing/csp";

export interface PageConfig {
    name?: string;
    matches?: string[];
}

export type PageEntrypointOptions = PageConfig & CspOptions & ViewOptions;

export type PageProps = PageEntrypointOptions;

export type PageDefinition = PageEntrypointOptions & ViewDefinition<PageProps>;
