import {ProxySandbox} from "@sandbox/providers";
import {parameters as sandboxParameters} from "#adnbn/sandbox";

import type {SandboxDefinition, SandboxMap, SandboxName, SandboxProxyTarget} from "@typing/sandbox";
import type {TransportType} from "@typing/transport";

export * from "@typing/sandbox";

export const defineSandbox = <T extends TransportType>(options: SandboxDefinition<T>): SandboxDefinition<T> => {
    return options;
};

export const getSandboxes = (): SandboxMap => {
    const sandboxes: SandboxMap = new Map();

    try {
        Object.entries(sandboxParameters).forEach(([key, value]) => {
            sandboxes.set(key, value);
        });
    } catch (e) {
        console.error("Failed getting sandboxes: ", e);
    }

    return sandboxes;
};

export const getSandbox = <N extends SandboxName>(name: N): SandboxProxyTarget<N> => {
    const parameters = getSandboxes().get(name);

    if (!parameters) {
        throw new Error(`Unable to get sandbox: ${name}`);
    }

    return new ProxySandbox(name, parameters).get() as SandboxProxyTarget<N>;
};
