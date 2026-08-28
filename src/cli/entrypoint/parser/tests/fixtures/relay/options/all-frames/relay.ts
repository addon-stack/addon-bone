import {defineRelay, RelayAllFrames, RelayMethod} from "adnbn";

export default defineRelay({
    method: RelayMethod.Messaging,
    allFrames: RelayAllFrames.All,
    init() {
        return {
            scan: () => true,
        };
    },
});
