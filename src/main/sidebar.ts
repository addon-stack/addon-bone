import {setSidebarPath, setSidebarTitle} from "@addon-core/browser";
import {aliases} from "#adnbn/sidebar";

import type {SidebarAlias, SidebarDefinition, SidebarMap} from "@typing/sidebar";

type Tab = chrome.tabs.Tab;

export type {SidebarAliasRegistry, SidebarAlias, SidebarMap} from "@typing/sidebar";

export const defineSidebar = (options: SidebarDefinition): SidebarDefinition => {
    return options;
};

export const getSidebars = (): SidebarMap => {
    const sidebars: SidebarMap = new Map();

    try {
        Object.entries(aliases).forEach(([key, value]) => {
            sidebars.set(key as SidebarAlias, value);
        });
    } catch (e) {
        console.error("Failed getting sidebars: ", e);
    }

    return sidebars;
};

export const changeSidebar = async (alias: SidebarAlias, tab?: number | Tab): Promise<void> => {
    const sidebar = getSidebars().get(alias);

    if (!sidebar) {
        throw new Error(`Not found sidebar: "${alias}"`);
    }

    if (tab && typeof tab === "object") {
        tab = tab.id;
    }

    const {path, title} = sidebar;

    if (!path) {
        throw new Error(`Not found sidebar path: "${alias}"`);
    }

    await setSidebarPath(path, tab);

    if (title) {
        await setSidebarTitle(title, tab);
    }
};
