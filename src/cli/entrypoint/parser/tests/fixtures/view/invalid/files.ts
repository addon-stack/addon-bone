import {definePage} from "adnbn";

export default definePage({
    // @ts-expect-error: The entrypoint selects its HTML file; this fixture verifies rejection.
    files: ["another.html"],
});
