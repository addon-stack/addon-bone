import path from 'path';

import ContentDriver from "./ContentDriver";

import {ContentProvider} from "./types";

import {RelayFinder} from "@cli/entrypoint";
import {virtualRelayModule} from "@cli/virtual";

import {RelayEntrypointOptions, RelayMethod} from "@typing/relay";
import {EntrypointFile} from "@typing/entrypoint";

export default class extends RelayFinder implements ContentProvider<RelayEntrypointOptions> {
    protected _driver?: ContentDriver<RelayEntrypointOptions>;

    public driver(): ContentDriver<RelayEntrypointOptions> {
        return (this._driver ??= new ContentDriver(this));
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

    public async getMethodsMap(): Promise<Record<string, RelayMethod | undefined>> {
        const methodByName: Record<string, RelayMethod | undefined> = {};

        (await this.options()).forEach((options, file) => {
            let relayName = options.name;

            if (!relayName) {
                const fileName = path.basename(file.import);
                relayName = fileName.includes('.') ? fileName.split('.')[0] : fileName;
            }

            methodByName[relayName] = options.method || RelayMethod.Scripting;
        });

        return methodByName;
    }

    public clear(): this {
        this._driver?.clear();

        return super.clear();
    }
}
