import {Offscreen, ProxyOffscreen, RegisterOffscreen} from "./providers";
import OffscreenBackground from "./OffscreenBackground";

import type {TransportProxyTarget, TransportTarget} from "@transport/index";

export {ProxyOffscreen, RegisterOffscreen, OffscreenBackground};

export interface OffscreenRegistry {}

export type OffscreenName = Extract<keyof OffscreenRegistry, string>;

export type OffscreenTarget<N extends keyof OffscreenRegistry> = TransportTarget<OffscreenRegistry, N>;

export type OffscreenProxyTarget<N extends keyof OffscreenRegistry> = TransportProxyTarget<OffscreenRegistry, N>;

export const getOffscreen = <N extends OffscreenName>(name: N): OffscreenTarget<N> => {
    return new Offscreen<N>(name).get();
};
