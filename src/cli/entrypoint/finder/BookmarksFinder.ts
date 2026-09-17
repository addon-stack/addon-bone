import AbstractOverrideFinder from "./AbstractOverrideFinder";

import {BookmarksParser} from "../parser";

import {ReadonlyConfig} from "@typing/config";
import {EntrypointParser, EntrypointType} from "@typing/entrypoint";
import {BookmarksEntrypointOptions, OverrideEntrypointType} from "@typing/override";

export default class BookmarksFinder extends AbstractOverrideFinder<BookmarksEntrypointOptions> {
    public constructor(config: ReadonlyConfig) {
        super(config);
    }

    public type(): OverrideEntrypointType {
        return EntrypointType.Bookmarks;
    }

    protected getParser(): EntrypointParser<BookmarksEntrypointOptions> {
        return new BookmarksParser(this.config);
    }
}
