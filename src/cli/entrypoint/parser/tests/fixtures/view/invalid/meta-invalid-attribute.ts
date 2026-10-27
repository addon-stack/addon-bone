import {definePage} from "adnbn";

export default definePage({
    // @ts-expect-error: Meta attribute values must be strings, booleans or numbers.
    metas: {attributes: {content: {value: "test"}}},
});
