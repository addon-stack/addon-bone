import {ProxySandbox} from "@sandbox/providers";

import {sandboxes as sandboxData} from "adnbn/virtual/sandbox";

import {SandboxDefinition, SandboxParameters, SandboxUnresolvedDefinition} from "@typing/sandbox";
import type {SandboxName, SandboxProxyTarget} from "@sandbox/index";
import type {TransportType} from "@typing/transport";

export * from "@typing/sandbox";

export type SandboxAlias = string;

export type SandboxMap = Map<SandboxAlias, SandboxParameters>;

export const defineSandbox = <T extends TransportType>(options: SandboxDefinition<T>): SandboxDefinition<T> => {
    return options;
};

export const getSandboxes = (): SandboxMap => {
    const sandboxes: SandboxMap = new Map();

    Object.entries(sandboxData).forEach(([key, value]) => {
        sandboxes.set(key, value);
    });

    return sandboxes;
};

export const getSandbox = <N extends SandboxName>(name: N): SandboxProxyTarget<N> => {
    const parameters = getSandboxes().get(name);

    if (!parameters) {
        throw new Error(`Unable to get sandbox: ${name}`);
    }

    return new ProxySandbox(name, parameters).get() as SandboxProxyTarget<N>;
};
