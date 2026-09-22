import AbstractOverrideParser from "./AbstractOverrideParser";

import {BookmarksEntrypointOptions} from "@typing/override";

export default class BookmarksParser extends AbstractOverrideParser<BookmarksEntrypointOptions> {
    protected definition(): string {
        return "defineBookmarks";
    }
}
