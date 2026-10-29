import {type Compiler, sources} from "@rspack/core";

interface ReplaceOptions {
    values: Record<string, string>;
}

export default class ReplacePlugin {
    constructor(private options: ReplaceOptions) {}

    apply(compiler: Compiler): void {
        compiler.hooks.emit.tap("ReplacePlugin", compilation => {
            for (const filename in compilation.assets) {
                let content = compilation.assets[filename].source().toString();
                let hasChanges = false;

                for (const [search, replace] of Object.entries(this.options.values)) {
                    if (content.includes(search)) {
                        content = content.replace(new RegExp(search, "g"), replace);
                        hasChanges = true;
                    }
                }

                if (hasChanges) {
                    compilation.updateAsset(filename, new sources.RawSource(content));
                }
            }
        });
    }
}
