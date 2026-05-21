import {View} from "../view";

import {SandboxFinder, SandboxViewFinder} from "@cli/entrypoint";
import {virtualSandboxModule} from "@cli/virtual";

import SandboxCsp from "./SandboxCsp";

import {EntrypointFile} from "@typing/entrypoint";
import {SandboxEntrypointOptions, SandboxParameters} from "@typing/sandbox";

export type SandboxParametersMap = Record<string, SandboxParameters>;

export default class extends SandboxFinder {
    protected _view?: View<SandboxEntrypointOptions>;

    protected _views?: SandboxViewFinder;

    public view(): View<SandboxEntrypointOptions> {
        return (this._view ??= new View(this.config, this.views()));
    }

    public views(): SandboxViewFinder {
        return (this._views ??= new SandboxViewFinder(this.config, this));
    }

    public virtual(file: EntrypointFile): string {
        const options = this._transport?.get(file)?.options;

        if (!options) {
            throw new Error(`Sandbox options not found for "${file.file}"`);
        }

        return virtualSandboxModule(file, options.name);
    }

    public async parameters(): Promise<SandboxParametersMap> {
        const sandboxes: SandboxParametersMap = {};
        const files = await this.transport();
        const filenames = await this.views().getFilenames();

        for (const [file, transport] of files) {
            const {name, readyTimeout, requestTimeout, removeOnRequestTimeout} = transport.options;
            const url = filenames.get(file);

            if (!url) {
                throw new Error(`Sandbox filename not found for "${file.file}"`);
            }

            sandboxes[name] = {
                url,
                readyTimeout,
                requestTimeout,
                removeOnRequestTimeout,
            };
        }

        return sandboxes;
    }

    public async sandboxes(): Promise<string[]> {
        return Object.values(await this.parameters()).map(({url}) => url);
    }

    public async contentSecurityPolicy(): Promise<string> {
        const csp = new SandboxCsp();

        for (const {options} of (await this.transport()).values()) {
            csp.add(options.csp);
        }

        return csp.build();
    }

    public clear(): this {
        this._view = undefined;
        this._views = undefined;

        return super.clear();
    }
}
