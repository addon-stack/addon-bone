import {setSidebarPath, setSidebarTitle} from "@addon-core/browser";

import {resolve} from "@locale/helpers";

import {sidebars as sidebarData} from "adnbn/virtual/sidebar";

import type {SidebarDefinition} from "@typing/sidebar";
import type {ManifestSidebar} from "@typing/manifest";

type Tab = chrome.tabs.Tab;

export type SidebarAlias = string;

export type SidebarMap = Map<SidebarAlias, ManifestSidebar>;

export const defineSidebar = (options: SidebarDefinition): SidebarDefinition => {
    return options;
};

export const getSidebars = (): SidebarMap => {
    const sidebars: SidebarMap = new Map();

    Object.entries(sidebarData).forEach(([key, value]) => {
        sidebars.set(key, value);
    });

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
        await setSidebarTitle(resolve(title), tab);
    }
};
