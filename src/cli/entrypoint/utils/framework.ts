import {EntrypointFile} from "@typing/entrypoint";
import {Framework} from "@typing/framework";

export const inferEntrypointFramework = (file: EntrypointFile): Framework => {
    if (/\.(jsx|tsx)$/.test(file.file)) {
        return Framework.React;
    }

    return Framework.Vanilla;
};
