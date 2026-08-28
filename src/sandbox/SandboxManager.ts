import TransportManager from "@transport/TransportManager";

import {SandboxGlobalKey} from "@typing/sandbox";

import type {TransportManager as TransportManagerContract} from "@typing/transport";

export default class SandboxManager extends TransportManager {
    public static getInstance(): TransportManagerContract {
        return (globalThis[SandboxGlobalKey] ??= new SandboxManager());
    }
}
