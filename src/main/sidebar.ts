import {
    canSetSidebarIcon,
    canSetSidebarTitle,
    getI18nMessage,
    setSidebarPath,
    setSidebarTitle,
} from "@addon-core/browser";
import {aliases} from "#adnbn/sidebar";

import {convertLocaleKey, extractLocaleKey} from "@shared/locale/keys";

import {changeSidebarIcon} from "./icon";

import type {IconName} from "@typing/icon";
import type {SidebarAlias, SidebarDefinition, SidebarMap} from "@typing/sidebar";

type Tab = chrome.tabs.Tab;

export type {SidebarAliasRegistry, SidebarAlias, SidebarMap, SidebarMapEntry} from "@typing/sidebar";

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

/**
 * Selects a sidebar globally or for a tab, updating its configured label and icon where supported.
 * An omitted icon preserves the current icon. Unsupported label and icon updates are skipped.
 * An omitted label preserves the current title. Locale markers use native browser translations.
 * Explicit empty strings, empty translations, and missing translations are passed as an empty title.
 * The browser controls how an empty title is displayed. Labels do not set document titles.
 */
export const changeSidebar = async (alias: SidebarAlias, tab?: number | Tab): Promise<void> => {
    const sidebar = getSidebars().get(alias);

    if (!sidebar) {
        throw new Error(`Not found sidebar: "${alias}"`);
    }

    if (tab && typeof tab === "object") {
        tab = tab.id;
    }

    const {path, label, icon} = sidebar;

    if (!path) {
        throw new Error(`Not found sidebar path: "${alias}"`);
    }

    await setSidebarPath(path, tab);

    if (label !== undefined && canSetSidebarTitle()) {
        const key = extractLocaleKey(label);
        const title = key ? (getI18nMessage(convertLocaleKey(key)) ?? "") : label;

        await setSidebarTitle(title, tab);
    }

    if (icon && canSetSidebarIcon()) {
        await changeSidebarIcon(icon as IconName, tab);
    }
};
