import {definePage} from "adnbn";

export default definePage({
    // @ts-expect-error: Meta attributes must be an object, not null.
    metas: {attributes: null},
});
