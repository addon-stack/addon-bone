import {getUrl} from "@addon-core/browser";
import {aliases} from "#adnbn/page";

import type {PageAlias, PageDefinition, PageMap} from "@typing/page";

export type {PageDefinition, PageProps, PageConfig, PageAliasRegistry, PageAlias, PageMap} from "@typing/page";

export const definePage = (options: PageDefinition): PageDefinition => {
    return options;
};

export const getPages = (): PageMap => {
    const pages: PageMap = new Map();

    try {
        Object.entries(aliases).forEach(([key, value]) => {
            pages.set(key, value);
        });
    } catch (e) {
        console.error("Failed getting pages: ", e);
    }

    return pages;
};

export const getPageUrl = (alias: PageAlias): string => {
    let path = getPages().get(alias);

    if (!path) {
        console.warn(`Cannot find page: ${alias}`);

        path = alias;
    }

    return getUrl(path);
};
