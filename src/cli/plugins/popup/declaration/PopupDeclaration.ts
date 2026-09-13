import {FileBuilder} from "@cli/plugins/typescript";

import {ReadonlyConfig} from "@typing/config";

export default class PopupDeclaration extends FileBuilder {
    protected alias = new Set<string>();

    constructor(config: ReadonlyConfig) {
        super(config);
    }

    protected filename(): string {
        return "popup.d.ts";
    }

    protected url(): string {
        return import.meta.url;
    }

    protected template(): string {
        let content = this.readFile();

        content = content.replace(
            "// :popup-aliases",
            Array.from(this.alias, alias => `${JSON.stringify(alias)}: true;`).join("\n        ")
        );

        return content;
    }

    public setAlias(alias: Set<string>): this {
        this.alias = alias;

        return this;
    }
}
