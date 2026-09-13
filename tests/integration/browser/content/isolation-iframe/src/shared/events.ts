import {ContentScriptEvent, type ContentScriptContext} from "adnbn";
export const observeMounts = (context: ContentScriptContext): void => {
    context.watch((event, node) => {
        if (event === ContentScriptEvent.Mount && node.container) {
            const count = Number(node.container.getAttribute("data-mounts") ?? 0) + 1;
            node.container.setAttribute("data-mounts", String(count));
            // Exercise document recovery before the first stylesheet request can finish.
            if (count === 1) node.container.parentElement!.append(node.container);
        }
    });
};
