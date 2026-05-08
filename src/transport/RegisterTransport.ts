import get from "get-value";

import BaseTransport from "./BaseTransport";

import {TransportDictionary, TransportMessage, TransportName, TransportRegister} from "@typing/transport";
import {MessageSender, MessageSenderProperty} from "@typing/message";

// prettier-ignore
export default abstract class<
    N extends TransportName,
    T extends object = TransportDictionary[N],
    A extends any[] = []
> extends BaseTransport<N, T> implements TransportRegister<T, A> {
    protected constructor(
        name: N,
        protected readonly init: (...args: A) => T
    ) {
        super(name);
    }

    protected abstract message(): TransportMessage;

    public register(...args: A): T {
        if (this.manager().has(this.name)) {
            throw new Error(`A instance with name "${this.name}" already exists. The name must be unique.`);
        }

        const instance = this.init(...args);

        this.manager().add(this.name, instance);

        this.message().watch(async ({path, args}, sender) => {
            try {
                const context = this.withSender(instance, sender);

                const property = path == null ? context : get(context, path);

                if (property === undefined) {
                    throw new Error(`Property not found at path "${path}" in "${this.name}"`);
                }

                let result: any;

                if (typeof property === "function") {
                    result = await property.apply(context, args);
                } else {
                    result = property;
                }

                return result;
            } catch (error) {
                console.error(`Error during message handler registration for transport "${this.name}"`, error);

                throw error;
            }
        });

        return instance;
    }

    private withSender(instance: T, sender: MessageSender): T {
        return new Proxy(instance, {
            get(target, property, receiver) {
                if (property === MessageSenderProperty) {
                    return sender;
                }

                return Reflect.get(target, property, receiver);
            },
        });
    }
}
