import type {TransportDictionary, TransportManager, TransportName} from "@typing/transport";

export default abstract class<N extends TransportName, T = TransportDictionary[N]> {
    protected constructor(protected readonly name: N) {}

    protected abstract manager(): TransportManager;

    public get(): T {
        const instance = this.manager().get(this.name);

        if (instance === undefined) {
            throw new Error(`Transport instance "${this.name}" is not registered in the current context.`);
        }

        return instance;
    }

    public destroy(): void {
        this.manager().remove(this.name);
    }
}
