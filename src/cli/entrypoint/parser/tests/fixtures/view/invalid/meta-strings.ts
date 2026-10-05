import {definePage} from "adnbn";

export default definePage({
    // @ts-expect-error: Meta tags require objects with attributes, not string paths.
    metas: ["utf-8"],
});
