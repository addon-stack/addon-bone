import {
    BookmarksDefinition,
    BookmarksProps,
    HistoryDefinition,
    HistoryProps,
    NewtabDefinition,
    NewtabProps,
} from "@typing/override";

export type {NewtabDefinition, NewtabProps, BookmarksDefinition, BookmarksProps, HistoryDefinition, HistoryProps};

export const defineNewtab = (options: NewtabDefinition): NewtabDefinition => {
    return options;
};

export const defineBookmarks = (options: BookmarksDefinition): BookmarksDefinition => {
    return options;
};

export const defineHistory = (options: HistoryDefinition): HistoryDefinition => {
    return options;
};
