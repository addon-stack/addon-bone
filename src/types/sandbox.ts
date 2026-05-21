import {TransportConfig, TransportDefinition, TransportType} from "@typing/transport";
import {ViewOptions} from "@typing/view";
import {Awaiter} from "@typing/helpers";
import {MessageError, MessageSender} from "@typing/message";

export const SandboxGlobalKey = "adnbnSandbox";
export const SandboxGlobalAccess = "adnbnSandboxAccess";
export const SandboxNamespace = "adnbn:sandbox";
export const SandboxReadyMessageType = `${SandboxNamespace}:ready`;
export const SandboxRequestMessageType = `${SandboxNamespace}:request`;
export const SandboxResponseMessageType = `${SandboxNamespace}:response`;

export enum SandboxAllow {
    Forms = "forms",
    Popups = "popups",
    Modals = "modals",
    Downloads = "downloads",
    PointerLock = "pointer-lock",
    TopNavigationByUserActivation = "top-navigation-by-user-activation",
}

export enum SandboxSource {
    Self = "'self'",
    None = "'none'",
    Data = "data:",
    Blob = "blob:",
    UnsafeInline = "'unsafe-inline'",
}

export interface SandboxContentSecurityPolicySources {
    connect?: Array<SandboxSource | `${SandboxSource}`>;
    image?: Array<SandboxSource | `${SandboxSource}`>;
    style?: Array<SandboxSource | `${SandboxSource}`>;
    font?: Array<SandboxSource | `${SandboxSource}`>;
    media?: Array<SandboxSource | `${SandboxSource}`>;
    worker?: Array<SandboxSource | `${SandboxSource}`>;
    child?: Array<SandboxSource | `${SandboxSource}`>;
}

export interface SandboxContentSecurityPolicy {
    eval?: boolean;
    inline?: boolean;
    allow?: Array<SandboxAllow | `${SandboxAllow}`>;
    sources?: SandboxContentSecurityPolicySources;
}

export interface SandboxConfig extends TransportConfig {
    csp?: SandboxContentSecurityPolicy;
    readyTimeout?: number;
    requestTimeout?: number;
    removeOnRequestTimeout?: boolean;
}

export type SandboxOptions = SandboxConfig & ViewOptions;

export type SandboxEntrypointOptions = Partial<SandboxOptions>;

export type SandboxMainHandler<T extends TransportType> = (
    sandbox: T,
    options: SandboxEntrypointOptions
) => Awaiter<void>;

export interface SandboxDefinition<T extends TransportType>
    extends TransportDefinition<SandboxOptions, T>, SandboxEntrypointOptions {
    main?: SandboxMainHandler<T>;
}

export type SandboxUnresolvedDefinition<T extends TransportType> = Partial<SandboxDefinition<T>>;

export type SandboxParameters = {url: string} & Pick<
    SandboxConfig,
    "readyTimeout" | "requestTimeout" | "removeOnRequestTimeout"
>;

export interface SandboxReadyMessage {
    type: typeof SandboxReadyMessageType;
    channel: string;
    name: string;
}

export interface SandboxRequestMessage {
    type: typeof SandboxRequestMessageType;
    channel: string;
    name: string;
    requestId: string;
    path?: string;
    args: any[];
}

export interface SandboxResponseMessage {
    type: typeof SandboxResponseMessageType;
    channel: string;
    name: string;
    requestId: string;
    ok: boolean;
    payload?: any;
    error?: MessageError;
}

export type SandboxEnvelope = SandboxRequestMessage | SandboxResponseMessage;

/**
 * Internal seam for the sandbox wire. Lives below `SandboxMessage`, invisible to callers.
 *
 * - `connect` establishes the channel (host: create the iframe and await the ready
 *   handshake; sandbox/in-memory: resolves immediately). Must be idempotent — concurrent
 *   callers share one connection.
 * - `post` sends one already-built envelope to the peer.
 * - `subscribe` attaches exactly one underlying listener and returns its remover.
 * - `dispose` tears the channel down (remove listener, drop the iframe).
 */
export interface SandboxPort {
    connect(): Promise<void>;

    post(message: SandboxEnvelope): void;

    subscribe(onMessage: (message: SandboxEnvelope, sender: MessageSender) => void): () => void;

    dispose(): void;
}
