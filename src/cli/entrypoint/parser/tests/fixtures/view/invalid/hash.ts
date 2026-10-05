import {definePage} from "adnbn";

export default definePage({
    // @ts-expect-error: Entrypoint hash must be a static boolean or string.
    hash: (asset: string) => asset,
});
