import {definePage} from "adnbn";

export default definePage({
    // @ts-expect-error: Entrypoint publicPath must be a static boolean or string.
    publicPath: (asset: string) => asset,
});
