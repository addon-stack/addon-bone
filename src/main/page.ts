import {getUrl} from "@addon-core/browser";

import {pages as pageData} from "adnbn/virtual/page";

import {PageConfig, PageDefinition, PageProps} from "@typing/page";

export type {PageDefinition, PageProps, PageConfig};

export type PageAlias = string;

export type PageMap = Map<PageAlias, string>;

export const definePage = (options: PageDefinition): PageDefinition => {
    return options;
};

export const getPages = (): PageMap => {
    const pages: PageMap = new Map();

    Object.entries(pageData).forEach(([key, value]) => {
        pages.set(key, value);
    });

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
