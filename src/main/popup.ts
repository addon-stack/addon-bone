import {setActionPopup, setActionTitle} from "@addon-core/browser";

import {resolve} from "@locale/helpers";

import {changeActionIcon} from "./icon";

import {popups as popupData} from "adnbn/virtual/popup";

import {PopupDefinition} from "@typing/popup";
import {ManifestPopup} from "@typing/manifest";

type Tab = chrome.tabs.Tab;

export type PopupAlias = string;

export type PopupMap = Map<PopupAlias, ManifestPopup>;

export const definePopup = (options: PopupDefinition): PopupDefinition => {
    return options;
};

export const getPopups = (): PopupMap => {
    const popups: PopupMap = new Map();

    Object.entries(popupData).forEach(([key, value]) => {
        popups.set(key, value);
    });

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
        await setActionTitle(resolve(title), tab);
    }

    if (icon) {
        await changeActionIcon(icon, tab);
    }
};
