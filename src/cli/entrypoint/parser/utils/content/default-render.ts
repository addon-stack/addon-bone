import {ExportValueKind, type ExportValue} from "../../../file";

/** Source metadata only: the CLI never loads a UI runtime to validate frame navigation. */
export const hasContentScriptDefaultRender = (exported?: ExportValue): boolean => {
    if (!exported) {
        return false;
    }

    switch (exported.kind) {
        case ExportValueKind.Function:
        case ExportValueKind.Class:
        case ExportValueKind.Jsx:
        case ExportValueKind.Number:
            return true;
        case ExportValueKind.String:
            return exported.value !== "";
        default:
            // Literal elements expose their runtime tag; inferred ReactElement/JSX.Element types
            // expose the public type/props/key fields instead (including imported element values).
            return (
                exported.properties.includes("$$typeof") ||
                ["type", "props", "key"].every(property => exported.properties.includes(property))
            );
    }
};
