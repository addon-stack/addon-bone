import {getI18nMessage, setActionPopup, setActionTitle} from "@addon-core/browser";
import {aliases} from "#adnbn/popup";

import {convertLocaleKey, extractLocaleKey} from "@shared/locale/keys";

import {changeActionIcon} from "./icon";

import type {PopupAlias, PopupDefinition, PopupMap} from "@typing/popup";
import type {IconName} from "@typing/icon";

type Tab = chrome.tabs.Tab;

export type {PopupAliasRegistry, PopupAlias, PopupMap, PopupMapEntry} from "@typing/popup";

export const definePopup = (options: PopupDefinition): PopupDefinition => {
    return options;
};

export const getPopups = (): PopupMap => {
    const popups: PopupMap = new Map();

    try {
        Object.entries(aliases).forEach(([key, value]) => {
            popups.set(key as PopupAlias, value);
        });
    } catch (e) {
        console.error("Failed getting popups: ", e);
    }

    return popups;
};

/**
 * Selects a popup globally or for a tab, updating its configured tooltip and icon.
 * An omitted tooltip preserves the current toolbar tooltip. Locale markers use native browser translations.
 * Explicit empty strings, empty translations, and missing translations are passed to the browser as an empty title.
 * The browser controls how an empty title is displayed; it does not guarantee a hidden tooltip.
 */
export const changePopup = async (alias: PopupAlias, tab?: number | Tab): Promise<void> => {
    const popup = getPopups().get(alias);

    if (!popup) {
        throw new Error(`Not found popup: "${alias}"`);
    }

    if (tab && typeof tab === "object") {
        tab = tab.id;
    }

    const {path, tooltip, icon} = popup;

    if (!path) {
        throw new Error(`Not found popup path: "${alias}"`);
    }

    await setActionPopup(path, tab);

    if (tooltip !== undefined) {
        const key = extractLocaleKey(tooltip);
        const title = key ? (getI18nMessage(convertLocaleKey(key)) ?? "") : tooltip;

        await setActionTitle(title, tab);
    }

    if (icon) {
        await changeActionIcon(icon as IconName, tab);
    }
};
