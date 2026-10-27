import type {LoaderContext} from "@rspack/core";
import resolveUrlLoader from "resolve-url-loader";

type StyleUrlRequest = {uri: string};

/** Keep explicit alias requests for css-loader instead of treating them as partial-local files. */
export const joinStyleUrl = (options: object, context: LoaderContext) => {
    const join = resolveUrlLoader.defaultJoin(options, context);

    return (request: StyleUrlRequest): string | null => {
        if (request.uri.startsWith("@")) {
            return null;
        }

        return join(request);
    };
};
