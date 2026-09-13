import {FileBuilder} from "@cli/plugins/typescript";

import {ReadonlyConfig} from "@typing/config";

export default class IconDeclaration extends FileBuilder {
    protected names = new Set<string>();

    constructor(config: ReadonlyConfig) {
        super(config);
    }

    protected filename(): string {
        return "icon.d.ts";
    }

    protected url(): string {
        return import.meta.url;
    }

    protected template(): string {
        let content = this.readFile();

        content = content.replace(
            "// :icon-names",
            Array.from(this.names, name => `${JSON.stringify(name)}: true;`).join("\n        ")
        );

        return content;
    }

    public setNames(names: Set<string>): this {
        this.names = names;

        return this;
    }
}
