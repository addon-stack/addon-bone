import {definePage} from "adnbn";

export default definePage({
    // @ts-expect-error: Every meta array item must be an object with attributes.
    metas: [{attributes: {charset: "utf-8"}}, "utf-8"],
});
