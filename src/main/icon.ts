import {setActionIcon, setSidebarIcon} from "@addon-core/browser";
import {groups} from "#adnbn/icon";

import {DefaultIconGroupName, type IconName, type IconsMap} from "@typing/icon";

type Tab = chrome.tabs.Tab;

export type {IconNameRegistry, IconName, IconsMap} from "@typing/icon";

export const getIcons = (): IconsMap => {
    const icons: IconsMap = new Map();

    try {
        Object.entries(groups).forEach(([key, value]) => {
            icons.set(key as IconName, value);
        });
    } catch (e) {
        console.error("Failed getting icons: ", e);
    }

    return icons;
};

export const changeActionIcon = async (icon?: IconName, tab?: number | Tab): Promise<void> => {
    if (!icon) {
        icon = DefaultIconGroupName as IconName;
    }

    const icons = getIcons().get(icon);

    if (!icons) {
        throw new Error(`Icon group name "${icon}" not found for action icon.`);
    }

    if (tab && typeof tab === "object") {
        tab = tab.id;
    }

    await setActionIcon({path: icons, tabId: tab});
};

export const changeSidebarIcon = async (icon?: IconName, tab?: number | Tab): Promise<void> => {
    if (!icon) {
        icon = DefaultIconGroupName as IconName;
    }

    const icons = getIcons().get(icon);

    if (!icons) {
        throw new Error(`Icon group name "${icon}" not found for sidebar icon.`);
    }

    if (tab && typeof tab === "object") {
        tab = tab.id;
    }

    await setSidebarIcon({path: icons, tabId: tab});
};
