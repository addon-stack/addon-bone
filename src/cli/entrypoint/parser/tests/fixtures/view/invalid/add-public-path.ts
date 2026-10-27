import {definePage} from "adnbn";

export default definePage({
    // @ts-expect-error: HTML callbacks belong to config.html, not static entrypoint options.
    addPublicPath: (asset: string) => asset,
});
