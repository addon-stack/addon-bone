import {ProxySandbox, RegisterSandbox} from "./providers";

import type {RpcAsyncProxy} from "@typing/rpc";

export {ProxySandbox, RegisterSandbox};

export interface SandboxRegistry {}

export type SandboxName = Extract<keyof SandboxRegistry, string>;

export type SandboxProxyTarget<N extends keyof SandboxRegistry> = RpcAsyncProxy<SandboxRegistry[N]>;
