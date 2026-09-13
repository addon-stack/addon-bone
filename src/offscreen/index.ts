import {Offscreen, ProxyOffscreen, RegisterOffscreen} from "./providers";
import OffscreenBackground from "./OffscreenBackground";

import type {OffscreenName, OffscreenTarget} from "@typing/offscreen";

export {ProxyOffscreen, RegisterOffscreen, OffscreenBackground};

export type {OffscreenRegistry, OffscreenName, OffscreenTarget, OffscreenProxyTarget} from "@typing/offscreen";

export const getOffscreen = <N extends OffscreenName>(name: N): OffscreenTarget<N> => {
    return new Offscreen<N>(name).get();
};
