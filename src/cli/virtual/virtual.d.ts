// Only placeholders belong here; real adnbn imports resolve to their source modules via tsconfig.json.
declare module "*?raw" {
    const content: string;
    export default content;
}

declare module "virtual:background-entrypoint" {
    type BackgroundDefinition = import("@typing/background").BackgroundDefinition;

    interface ModuleType extends BackgroundDefinition {
        default: BackgroundDefinition | BackgroundDefinition["main"] | undefined;
    }

    const module: ModuleType;
    export = module;
}

declare module "virtual:command-entrypoint" {
    type CommandDefinition = import("@typing/command").CommandDefinition;

    interface ModuleType extends CommandDefinition {
        default: CommandDefinition | CommandDefinition["execute"] | undefined;
    }

    const module: ModuleType;
    export = module;
}

declare module "virtual:content-entrypoint" {
    type ContentScriptDefinition = import("@typing/content").ContentScriptDefinition;

    interface ModuleType extends ContentScriptDefinition {
        default: ContentScriptDefinition | ContentScriptDefinition["render"] | undefined;
    }

    const module: ModuleType;
    export = module;
}

declare module "virtual:content-framework" {
    export const Builder:
        | typeof import("@entry/content/adapters/vanilla").Builder
        | typeof import("@entry/content/adapters/react").Builder;

    const content:
        | typeof import("@entry/content/adapters/vanilla").default
        | typeof import("@entry/content/adapters/react").default;
    export default content;
}

declare module "virtual:offscreen-entrypoint" {
    type OffscreenDefinition = import("@typing/offscreen").OffscreenDefinition<
        import("@typing/transport").TransportType
    >;

    interface ModuleType extends OffscreenDefinition {
        default: OffscreenDefinition | OffscreenDefinition["init"] | undefined;
    }

    const module: ModuleType;
    export = module;
}

declare module "virtual:relay-entrypoint" {
    type RelayDefinition = import("@typing/relay").RelayDefinition<import("@typing/transport").TransportType>;

    export const {
        init,
        main,
        name,
        method,
        allFrames,
        matches,
        excludeMatches,
        includeGlobs,
        excludeGlobs,
        runAt,
        world,
        matchAboutBlank,
        matchOriginAsFallback,
        declarative,
        marker,
        anchor,
        mount,
        render,
        container,
        watch,
        includeBrowser,
        excludeBrowser,
        includeApp,
        excludeApp,
        mode,
        manifestVersion,
        debug,
    }: Partial<RelayDefinition>;

    const definition: RelayDefinition | RelayDefinition["init"] | undefined;
    export default definition;
}

declare module "virtual:sandbox-entrypoint" {
    type SandboxDefinition = import("@typing/sandbox").SandboxDefinition<any>;

    interface ModuleType extends SandboxDefinition {
        default: SandboxDefinition | SandboxDefinition["init"] | undefined;
    }

    const module: ModuleType;
    export = module;
}

declare module "virtual:view-entrypoint" {
    import {ViewOptions} from "@typing/view";

    type ViewDefinition = import("@typing/view").ViewDefinition<ViewOptions>;

    interface ModuleType extends ViewDefinition {
        default: ViewDefinition | ViewDefinition["render"] | undefined;
    }

    const module: ModuleType;
    export = module;
}

declare module "virtual:view-framework" {
    export const Builder:
        | typeof import("@entry/view/adapters/vanilla").Builder
        | typeof import("@entry/view/adapters/react").Builder;

    const view:
        | typeof import("@entry/view/adapters/vanilla").default
        | typeof import("@entry/view/adapters/react").default;
    export default view;
}

declare module "virtual:transport-entrypoint" {
    type TransportDefinition = import("@typing/transport").TransportDefinition<any, any>;

    interface ModuleType extends TransportDefinition {
        default: TransportDefinition | TransportDefinition["init"] | undefined;
    }

    const module: ModuleType;
    export = module;
}

declare module "adnbn/entry/:entry" {
    import type {TransportUnresolvedDefinition, TransportOptions, TransportType} from "@typing/transport";

    const transport: (definition: TransportUnresolvedDefinition<TransportOptions, TransportType>) => void;
    export default transport;
}
