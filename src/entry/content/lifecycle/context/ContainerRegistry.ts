/** Tracks independent mount registrations without adding ownership to lifecycle nodes. */
export default class ContainerRegistry {
    private readonly registrations = new Map<Node, Set<{anchor: Element}>>();

    public register(container: Element, anchor: Element): () => void {
        let registrations = this.registrations.get(container);

        if (!registrations) {
            registrations = new Set();
            this.registrations.set(container, registrations);
        }

        const registration = {anchor};
        const current = registrations;
        current.add(registration);

        return () => {
            if (!current.delete(registration)) {
                return;
            }

            if (current.size === 0 && this.registrations.get(container) === current) {
                this.registrations.delete(container);
            }
        };
    }

    public owns(target: Node): boolean {
        if (this.registrations.size === 0) {
            return false;
        }

        let current: Node | null = target;

        while (current) {
            const registrations = this.registrations.get(current);
            const container = current;

            if (registrations && !Array.from(registrations).some(({anchor}) => container.contains(anchor))) {
                return true;
            }

            const shadowRoot: typeof ShadowRoot = current.ownerDocument?.defaultView?.ShadowRoot ?? ShadowRoot;
            current = current.parentNode ?? (current instanceof shadowRoot ? current.host : null);
        }

        return false;
    }

    public clear(): void {
        this.registrations.clear();
    }
}
