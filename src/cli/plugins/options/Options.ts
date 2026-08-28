import View from "../view/View";
import OptionsFinder from "@cli/entrypoint/finder/OptionsFinder";

import type {OptionsEntrypointOptions} from "@typing/options";
import type {ManifestOptions} from "@typing/manifest";

export default class extends OptionsFinder {
    protected _view?: View<OptionsEntrypointOptions>;

    public view(): View<OptionsEntrypointOptions> {
        return (this._view ??= new View(this.config, this));
    }

    public async manifest(): Promise<ManifestOptions | undefined> {
        const [view] = (await this.views()).values();

        if (!view) {
            return;
        }

        const {openInTab} = (await this.plugin().options()).get(view.file) ?? {};

        return {path: view.filename, openInTab};
    }

    public clear(): this {
        this._view = undefined;

        return super.clear();
    }
}
