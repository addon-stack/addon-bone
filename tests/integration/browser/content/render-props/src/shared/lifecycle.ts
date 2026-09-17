import type {ContentScriptContext} from "adnbn";

export function main(context: ContentScriptContext) {
    const events: string[] = [];
    let update: (() => void) | undefined;

    context.watch(event => {
        events.push(event);
        update?.();
    });

    document.addEventListener("probe-command", event => {
        const {id, command} = JSON.parse((event as CustomEvent<string>).detail) as {id: string; command: string};
        const node = [...context.nodes].find(node => node.anchor.id === id);

        if (!node) {
            return;
        }

        try {
            update = undefined;
            events.length = 0;
            let mounted: ReturnType<typeof node.mount>;

            if (command === "remount") {
                node.unmount();
                mounted = node.mount();
            }

            if (command === "unmount") {
                node.unmount();
            }

            if (command === "mount") {
                mounted = node.mount();
            }

            if (command === "click") {
                (node.target?.querySelector("button") as HTMLButtonElement)?.click();
            }

            if (command === "frame-reload") {
                const boundary = node.boundary;

                if (boundary && "contentWindow" in boundary) {
                    boundary.contentWindow!.location.reload();
                }
            }

            node.anchor.setAttribute("data-tracked", String(context.nodes.size));
            node.anchor.setAttribute("data-command", command);

            update = () => {
                node.anchor.setAttribute(
                    "data-lifecycle",
                    JSON.stringify({
                        events,
                        mounted,
                        connected: node.target?.isConnected,
                        text: node.target?.textContent,
                    })
                );
            };

            update();
        } catch (error) {
            document.body.dataset.error = String(error);
        }
    });
}
