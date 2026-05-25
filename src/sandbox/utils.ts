import {SandboxGlobalAccess, SandboxNamespace} from "@typing/sandbox";
import type {MessageSender} from "@typing/message";

export const isSandbox = (): boolean => globalThis[SandboxGlobalAccess] === true;

export const sandboxChannel = (name: string): string => `${SandboxNamespace}:${name}`;

export const sandboxSender = (): MessageSender =>
    ({url: document.location.href, origin: document.location.origin}) as MessageSender;
