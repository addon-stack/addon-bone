import ViewCspParser from "./ViewCspParser";

import {BookmarksEntrypointOptions} from "@typing/override";

export default class BookmarksParser extends ViewCspParser<BookmarksEntrypointOptions> {
    protected definition(): string {
        return "defineBookmarks";
    }
}
