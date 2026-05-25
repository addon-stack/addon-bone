import ViewCspFinder from "./ViewCspFinder";
import PluginFinder from "./PluginFinder";

import {PageParser} from "../parser";
import {InlineNameGenerator} from "../name";

import {ReadonlyConfig} from "@typing/config";
import {PageEntrypointOptions} from "@typing/page";
import {
    EntrypointFile,
    EntrypointNameGenerator,
    EntrypointOptionsFinder,
    EntrypointParser,
    EntrypointType,
} from "@typing/entrypoint";

export default class extends ViewCspFinder<PageEntrypointOptions> {
    constructor(config: ReadonlyConfig) {
        super(config);
    }

    public type(): EntrypointType {
        return EntrypointType.Page;
    }

    protected createFilenameGenerator(): EntrypointNameGenerator {
        return new InlineNameGenerator(this.type())
            .reserve(EntrypointType.Background)
            .reserve(EntrypointType.Command)
            .reserve(EntrypointType.ContentScript)
            .reserve(EntrypointType.Sidebar)
            .reserve(EntrypointType.Popup)
            .reserve(EntrypointType.Offscreen)
            .reserve(EntrypointType.Sandbox)
            .reserve(EntrypointType.Options);
    }

    protected createViewAlias(file: EntrypointFile, options: PageEntrypointOptions): string {
        const {name} = options;

        let alias = name ? this.aliases.name(name) : this.aliases.file(file);

        if (file.external) {
            alias = file.import;
        }

        return alias;
    }

    protected getParser(): EntrypointParser<PageEntrypointOptions> {
        return new PageParser(this.config);
    }

    protected getPlugin(): EntrypointOptionsFinder<PageEntrypointOptions> {
        return new PluginFinder(this.config, "page", this);
    }

    public canMerge(): boolean {
        return this.config.mergePages;
    }
}
