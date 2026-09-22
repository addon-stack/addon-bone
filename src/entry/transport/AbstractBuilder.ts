import Builder from "@entry/core/Builder";

import {isValidTransportInitFunction, isValidTransportMainFunction, isValidTransportName} from "./resolvers/definition";

import {
    TransportOptions,
    TransportRegister,
    TransportResolvedDefinition,
    TransportType,
    TransportUnresolvedDefinition,
} from "@typing/transport";
import {EntrypointBuilder} from "@typing/entrypoint";

// prettier-ignore
export default abstract class<
    O extends TransportOptions,
    T extends TransportType = TransportType
> extends Builder implements EntrypointBuilder {
    protected readonly definition: TransportResolvedDefinition<O, T>;

    protected instance?: TransportRegister<T, [O]>;

    protected abstract transport(): TransportRegister<T, [O]>;

    protected constructor(definition: TransportUnresolvedDefinition<O, T>) {
        super();

        const {name, init} = definition;

        if (!isValidTransportInitFunction(init)) {
            throw new Error("The transport entrypoint must export a init function");
        }

        if (!isValidTransportName(name)) {
            throw new Error("The transport entrypoint must export a name string");
        }

        this.definition = {
            ...definition,
            name,
            init,
        };
    }

    public get(): T {
        if (!this.instance) {
            throw new Error("Before using get function run build() method");
        }

        return this.instance.get();
    }

    public async build(): Promise<void> {
        await this.destroy();

        const {name, init, main, ...definition} = this.definition;

        const options: TransportOptions = {
            name,
            ...definition,
        };

        this.instance = this.transport();

        this.instance.register(options as O);

        if (isValidTransportMainFunction(main)) {
            await main(this.instance.get(), options);
        }
    }

    public async destroy(): Promise<void> {
        this.instance?.destroy();

        this.instance = undefined;
    }
}
