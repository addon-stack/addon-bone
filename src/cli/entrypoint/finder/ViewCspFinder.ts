import AbstractViewFinder, {ViewItems} from "./AbstractViewFinder";

import type {ViewCspEntrypointOptions} from "../parser/ViewCspParser";

import type {CspConfig} from "@typing/csp";

export default abstract class<O extends ViewCspEntrypointOptions> extends AbstractViewFinder<O> {
    protected async getViews(): Promise<ViewItems<O>> {
        const views = await super.getViews();

        for (const view of views.values()) {
            const {csp, ...options} = view.options;

            view.options = options as O;
        }

        return views;
    }

    public async csp(): Promise<CspConfig[]> {
        const policies: CspConfig[] = [];

        for (const [, options] of await this.plugin().options()) {
            if (options.csp) {
                policies.push(options.csp);
            }
        }

        return policies;
    }
}
