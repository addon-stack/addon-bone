import AbstractViewFinder, {ViewItems} from "./AbstractViewFinder";

import type {CspConfig} from "@typing/csp";
import type {ViewEntrypointOptions} from "@typing/view";

type CspEntrypointOptions = ViewEntrypointOptions & {csp?: unknown};

export default abstract class<O extends CspEntrypointOptions, Csp = CspConfig> extends AbstractViewFinder<O> {
    protected async getViews(): Promise<ViewItems<O>> {
        const views = await super.getViews();

        for (const view of views.values()) {
            const {csp, ...options} = view.options;

            view.options = options as O;
        }

        return views;
    }

    public async csp(): Promise<Csp[]> {
        const policies: Csp[] = [];

        for (const [, options] of await this.plugin().options()) {
            if (options.csp) {
                policies.push(options.csp as Csp);
            }
        }

        return policies;
    }
}
