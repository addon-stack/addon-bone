import {ProxySandbox, RegisterSandbox} from "./providers";

import type {DeepAsyncProxy} from "@typing/helpers";

export {ProxySandbox, RegisterSandbox};

export interface SandboxRegistry {}

export type SandboxName = Extract<keyof SandboxRegistry, string>;

export type SandboxProxyTarget<N extends keyof SandboxRegistry> = DeepAsyncProxy<SandboxRegistry[N]>;
