import {setActionPopup, setActionTitle} from "@addon-core/browser";
import {aliases} from "#adnbn/popup";

import {changeActionIcon} from "./icon";

import type {PopupAlias, PopupDefinition, PopupMap} from "@typing/popup";
import type {IconName} from "@typing/icon";

type Tab = chrome.tabs.Tab;

export type {PopupAliasRegistry, PopupAlias, PopupMap} from "@typing/popup";

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

export const changePopup = async (alias: PopupAlias, tab?: number | Tab): Promise<void> => {
    const popup = getPopups().get(alias);

    if (!popup) {
        throw new Error(`Not found popup: "${alias}"`);
    }

    if (tab && typeof tab === "object") {
        tab = tab.id;
    }

    const {path, title, icon} = popup;

    if (!path) {
        throw new Error(`Not found popup path: "${alias}"`);
    }

    await setActionPopup(path, tab);

    if (title) {
        await setActionTitle(title, tab);
    }

    if (icon) {
        await changeActionIcon(icon as IconName, tab);
    }
};
