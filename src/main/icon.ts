import {setActionIcon, setSidebarIcon} from "@addon-core/browser";

import {icons as iconData} from "adnbn/virtual/icon";

import {DefaultIconGroupName} from "@typing/icon";

type Tab = chrome.tabs.Tab;

export type IconName = string;

export type IconsMap = Map<IconName, Record<number, string>>;

export const getIcons = (): IconsMap => {
    const icons: IconsMap = new Map();

    Object.entries(iconData).forEach(([key, value]) => {
        icons.set(key, value);
    });

    return icons;
};

export const changeActionIcon = async (icon?: IconName, tab?: number | Tab): Promise<void> => {
    if (!icon) {
        icon = DefaultIconGroupName;
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
        icon = DefaultIconGroupName;
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
