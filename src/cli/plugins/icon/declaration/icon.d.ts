import ":package";

declare module ":package" {
    export type IconName = string;

    export function changeActionIcon(icon?: IconName, tab?: number | chrome.tabs.Tab): Promise<void>;

    export function changeSidebarIcon(icon?: IconName, tab?: number | chrome.tabs.Tab): Promise<void>;
}
