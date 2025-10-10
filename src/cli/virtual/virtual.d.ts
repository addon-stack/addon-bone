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
    import {ContentScriptDefinition, ContentScriptBuilder} from "@typing/content";

    export const Builder = ContentScriptBuilder;

    const module: (definition: ContentScriptDefinition) => void;
    export = module;
}

declare module "virtual:offscreen-entrypoint" {
    type OffscreenDefinition = import("@typing/offscreen").OffscreenDefinition<any, any>;

    interface ModuleType extends OffscreenDefinition {
        default: OffscreenDefinition | OffscreenDefinition["init"] | undefined;
    }

    const module: ModuleType;
    export = module;
}

declare module "virtual:relay-entrypoint" {
    type RelayDefinition = import("@typing/relay").RelayDefinition<any, any>;

    interface ModuleType extends RelayDefinition {
        default: RelayDefinition | RelayDefinition["init"] | undefined;
    }

    const module: ModuleType;
    export = module;
}

declare module "virtual:relay-framework" {
    type RelayUnresolvedDefinition = import("@typing/relay").RelayUnresolvedDefinition<any>;

    const module: (definition: RelayUnresolvedDefinition) => void;
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
    import {ViewOptions, ViewBuilder} from "@typing/view";

    type ViewDefinition = import("@typing/view").ViewDefinition<ViewOptions>;

    export const Builder = ViewBuilder;

    const module: (definition: ViewDefinition) => void;
    export = module;
}

declare module "virtual:transport-entrypoint" {
    type TransportDefinition = import("@typing/transport").TransportDefinition<any, any>;

    interface ModuleType extends TransportDefinition {
        default: TransportDefinition | TransportDefinition["init"] | undefined;
    }

    const module: ModuleType;
    export = module;
}

declare module "adnbn" {
    export type BackgroundDefinition = import("@typing/background").BackgroundDefinition;
    export type CommandUnresolvedDefinition = import("@typing/command").CommandUnresolvedDefinition;
    export type ContentScriptDefinition = import("@typing/content").ContentScriptDefinition;
    export type ViewOptions = import("@typing/view").ViewOptions;
    export type ViewDefinition<T extends ViewOptions = ViewOptions> = import("@typing/view").ViewDefinition<T>;
    export type OffscreenUnresolvedDefinition<T extends import("@typing/transport").TransportType> =
        import("@typing/offscreen").OffscreenUnresolvedDefinition<T>;
    export type RelayUnresolvedDefinition<T extends import("@typing/transport").TransportType> =
        import("@typing/relay").RelayUnresolvedDefinition<T>;
}

declare module "adnbn/transport" {
    export type TransportType = import("@typing/transport").TransportType;
    export type TransportOptions = import("@typing/transport").TransportOptions;
    export type TransportUnresolvedDefinition<
        O extends import("@typing/transport").TransportOptions,
        T extends import("@typing/transport").TransportType,
    > = import("@typing/transport").TransportUnresolvedDefinition<O, T>;
}

declare module "adnbn/locale" {
    export function __t(value: string): string;
}

declare module "adnbn/entry/background" {
    import type {BackgroundDefinition, BackgroundMainHandler} from "@typing/background";

    export function isValidBackgroundDefinition(value: unknown): value is BackgroundDefinition;

    export function isValidBackgroundMainHandler(value: unknown): value is BackgroundMainHandler;

    const background: (definition: BackgroundDefinition) => void;
    export default background;
}

declare module "adnbn/entry/command" {
    import type {CommandDefinition, CommandExecute, CommandUnresolvedDefinition} from "@typing/command";

    export function isValidCommandDefinition(value: unknown): value is CommandDefinition;

    export function isValidCommandExecuteFunction(value: unknown): value is CommandExecute;

    const command: (definition: CommandUnresolvedDefinition) => void;
    export default command;
}

declare module "adnbn/entry/content" {
    import type {ContentScriptDefinition, ContentScriptRenderValue} from "@typing/content";

    export function isContentScriptDefinition(value: unknown): value is ContentScriptDefinition;

    export function isValidContentScriptDefinitionRenderValue(value: unknown): value is ContentScriptRenderValue;
}

declare module "adnbn/entry/view" {
    import type {ViewOptions, ViewDefinition, ViewRenderValue} from "@typing/view";

    export function isViewDefinition(value: unknown): value is ViewDefinition<ViewOptions>;

    export function isValidViewDefinitionRenderValue(value: unknown): value is ViewRenderValue<ViewOptions>;
}

declare module "adnbn/entry/transport" {
    export function isValidTransportDefinition(value: unknown): value is any;

    export function isValidTransportInitFunction(value: unknown): value is (...args: any[]) => any;
}

declare module "adnbn/entry/offscreen" {
    import type {OffscreenDefinition, OffscreenUnresolvedDefinition} from "@typing/offscreen";
    import type {TransportType} from "@typing/transport";
    import type {ViewBuilder} from "@typing/view";

    export class Builder {
        constructor(options: OffscreenDefinition<TransportType> | OffscreenUnresolvedDefinition<TransportType>);

        view(builder: ViewBuilder): this;

        build(): Promise<void>;
    }
}

declare module "adnbn/entry/relay" {
    import type {RelayDefinition, RelayUnresolvedDefinition} from "@typing/relay";
    import type {TransportType} from "@typing/transport";
    import type {ContentScriptBuilder} from "@typing/content";

    export class Builder {
        constructor(options: RelayDefinition<TransportType> | RelayUnresolvedDefinition<TransportType>);

        content(builder: ContentScriptBuilder): this;

        build(): Promise<void>;
    }
}

declare module "adnbn/offscreen" {
    export class OffscreenBackground {
        build(): void | Promise<void>;
    }
}

declare module "adnbn/entry/:entry" {
    import type {TransportUnresolvedDefinition, TransportOptions, TransportType} from "@typing/transport";

    const transport: (definition: TransportUnresolvedDefinition<TransportOptions, TransportType>) => void;
    export default transport;
}
