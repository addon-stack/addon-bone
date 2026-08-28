import RelayDriver from "./RelayDriver";

import {ContentProvider} from "./types";

import {RelayFinder} from "@cli/entrypoint";
import {virtualRelayModule} from "@cli/virtual";

import {RelayMethod, RelayOptions} from "@typing/relay";
import {ContentScriptEntrypointOptions} from "@typing/content";
import {EntrypointFile} from "@typing/entrypoint";

export default class extends RelayFinder implements ContentProvider<ContentScriptEntrypointOptions> {
    protected _driver?: RelayDriver;

    public driver(): RelayDriver {
        return (this._driver ??= new RelayDriver(this));
    }

    /**
     * Before creating the virtual module, it is necessary to run a command `await this.transport()` that caches the Relays.
     * This command is executed during the type declaration generation stage for the Relays.
     */
    public virtual(file: EntrypointFile): string {
        const options = this._transport?.get(file)?.options;

        if (!options) {
            throw new Error(`Relay options not found for "${file}"`);
        }

        return virtualRelayModule(file, options.name);
    }

    public async getOptionsMap(): Promise<Record<string, RelayOptions>> {
        const transport = await this.transport();

        return Array.from(transport.values()).reduce(
            (map, {options}) => {
                map[options.name] = {
                    ...options,
                    method: options.method || RelayMethod.Messaging,
                };

                return map;
            },
            {} as Record<string, RelayOptions>
        );
    }

    public clear(): this {
        this._driver?.clear();

        return super.clear();
    }
}
