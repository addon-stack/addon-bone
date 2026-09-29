import type {IconName} from "@typing/icon";

/** Default appearance of the extension's toolbar button. */
export interface ActionOptions {
    /** Icon group name. Falls back to `config.icon` when omitted. */
    icon?: IconName;

    /** Tooltip text or locale key, such as `@action.title`. Defaults to the extension name. */
    title?: string;
}
