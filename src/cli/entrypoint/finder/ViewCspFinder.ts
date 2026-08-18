import AbstractViewFinder, {ViewItems} from "./AbstractViewFinder";

import type {CspConfig} from "@typing/csp";
import type {ViewEntrypointOptions} from "@typing/view";

type CspEntrypointOptions = ViewEntrypointOptions & {csp?: unknown};

export default abstract class<O extends CspEntrypointOptions, Csp = CspConfig> extends AbstractViewFinder<O> {
    protected _csp?: Csp[];

    protected async getViews(): Promise<ViewItems<O>> {
        const views = await super.getViews();
        const policies: Csp[] = [];

        for (const view of views.values()) {
            const {csp, ...options} = view.options;

            if (csp) {
                policies.push(csp as Csp);
            }

            view.options = options as O;
        }

        this._csp = policies;

        return views;
    }

    public async csp(): Promise<Csp[]> {
        if (!this._csp) {
            await this.views();
        }

        return this._csp ?? [];
    }

    public clear(): this {
        this._csp = undefined;

        return super.clear();
    }
}
