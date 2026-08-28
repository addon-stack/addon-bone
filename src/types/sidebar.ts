import {ViewDefinition, ViewOptions} from "@typing/view";
import {Browser} from "@typing/browser";
import {CspOptions} from "@typing/csp";

export const SidebarAlternativeBrowsers: ReadonlySet<Browser> = new Set([Browser.Opera, Browser.Firefox]);

export interface SidebarConfig {
    icon?: string;
    apply?: boolean;
}

export type SidebarEntrypointOptions = SidebarConfig & CspOptions & ViewOptions;

export type SidebarProps = SidebarEntrypointOptions;

export type SidebarDefinition = SidebarEntrypointOptions & ViewDefinition<SidebarProps>;
