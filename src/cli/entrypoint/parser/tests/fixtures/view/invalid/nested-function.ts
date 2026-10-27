import {definePage} from "adnbn";

export default definePage({
    // @ts-expect-error: Nested HTML callbacks are also forbidden in static entrypoint options.
    scripts: [{path: "script.js", hash: (asset: string) => asset}],
});
