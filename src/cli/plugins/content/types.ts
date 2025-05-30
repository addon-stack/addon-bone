import {ContentScriptEntrypointOptions} from "@typing/content";
import {EntrypointFile} from "@typing/entrypoint";

export interface ContentItem<O extends ContentScriptEntrypointOptions> {
    file: EntrypointFile;
    options: O;
}

export type ContentItems<O extends ContentScriptEntrypointOptions> = Map<string, ContentItem<O>>;

export type ContentGroupItems<O extends ContentScriptEntrypointOptions> = Map<string, Set<ContentItem<O>>>;

export interface ContentNameGenerator<O extends ContentScriptEntrypointOptions> {
    create(name: string, options: O): string;
}

export interface ContentDriver<O extends ContentScriptEntrypointOptions> {
    items(): Promise<ContentItems<O>>;
}

export interface ContentProvider<O extends ContentScriptEntrypointOptions> {
    virtual(file: EntrypointFile): string;

    driver(): ContentDriver<O>;

    clear(): this;
}
