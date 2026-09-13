import Relay from "./providers/Relay";

import type {RelayName, RelayTarget} from "@typing/relay";

export type {RelayRegistry, RelayName, RelayTarget} from "@typing/relay";

export const getRelay = <N extends RelayName>(name: N): RelayTarget<N> => {
    return new Relay<N>(name).get();
};
