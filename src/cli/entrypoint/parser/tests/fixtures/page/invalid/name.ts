import {definePage} from "adnbn";

export default definePage({
    // @ts-expect-error: A page name must be a string.
    name: 42,
});
