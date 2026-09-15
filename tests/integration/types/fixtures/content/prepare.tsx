import {ContentScriptAppend, defineContentScript, defineContentScriptAppend, defineRelay} from "adnbn";
import type {ContentScriptMount, ContentScriptProps, ContentScriptRenderReactComponent} from "adnbn";

const service = {get: async () => ({title: "Product", visible: true})};

defineContentScript({
    prepare: async ({anchor}) => {
        const product = await service.get();

        if (!anchor.isConnected || !product.visible) {
            return false;
        }

        return {product};
    },

    container: ({data, anchor}) => {
        const title: string = data.product.title;

        return {tagName: "section", title: title + anchor.tagName};
    },

    render: ({data, container, target, anchor}) => {
        const title: string = data.product.title;
        // @ts-expect-error: data retains the prepared shape.
        data.missing;
        // @ts-expect-error: title is not a number.
        const invalid: number = data.product.title;
        container.setAttribute("title", title);

        return <span>{target.ownerDocument === anchor.ownerDocument ? title : "iframe"}</span>;
    },
});

defineContentScriptAppend({
    append: ContentScriptAppend.Last,

    prepare: ({anchor}) => {
        // @ts-expect-error: append retains contextual prepare props.
        const invalid: number = anchor;

        return {count: anchor.childElementCount};
    },

    render: ({data}) => {
        const count: number = data.count;
        // @ts-expect-error: append retains data inference.
        data.missing;

        return count;
    },
});

defineRelay({
    name: "prepared",
    init: () => service,

    prepare: async ({anchor}) => {
        const product = await service.get();
        // @ts-expect-error: Relay retains contextual prepare props.
        const invalid: number = anchor;

        if (!anchor.isConnected) {
            return false;
        }

        return {product};
    },

    render: ({data}) => {
        const title: string = data.product.title;
        // @ts-expect-error: Relay shares the typed Content contract.
        data.missing;

        return title;
    },
});

defineContentScript({
    prepare: props => {
        // @ts-expect-error: preparation has no UI container.
        props.container;
        // @ts-expect-error: preparation has no target.
        props.target;

        return {value: 1};
    },

    render: ({data}) => data.value,
});

defineContentScript({
    render: ({data}) => {
        const absent: undefined = data;

        return null;
    },
});

const Panel = ({data}: ContentScriptProps<{title: string}>) => <span>{data.title}</span>;
defineContentScript({prepare: () => ({title: "Typed"}), render: Panel});

// @ts-expect-error: Asynchronous work belongs in prepare, not the render handler.
defineContentScript({render: async () => document.createElement("div")});
// @ts-expect-error: The append variant also requires synchronous rendering.
defineContentScriptAppend({render: async () => "content"});
// @ts-expect-error: Relay uses the same synchronous render contract.
defineRelay({name: "async-render", init: () => service, render: async () => <span />});
// @ts-expect-error: Promise render values are not part of the Content contract.
defineContentScript({render: Promise.resolve(<span />)});
// @ts-expect-error: Prepare data before passing it to a synchronous React component.
const AsyncPanel: ContentScriptRenderReactComponent = async () => <span />;

function useMount(node: ContentScriptMount): void {
    const mounted: boolean | undefined | void = node.mount();
    const unmounted: boolean | undefined | void = node.unmount();
}
