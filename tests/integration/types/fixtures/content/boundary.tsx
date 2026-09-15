import {defineContentScript, defineContentScriptAppend, defineRelay} from "adnbn";
import type {ContentScriptBoundaryHandler, ContentScriptBoundaryProps} from "adnbn";

defineContentScript({
    isolation: "iframe",
    prepare: async ({anchor}) => ({title: anchor.tagName}),

    boundary: props => {
        const frame: HTMLIFrameElement = props.boundary;
        const title: string = props.data.title;
        const container: Element = props.container;
        // @ts-expect-error: iframe setup does not receive a ShadowRoot.
        props.boundary.host;
        // @ts-expect-error: boundary data retains the prepare result.
        props.data.missing;
        // @ts-expect-error: the inner target does not exist during setup.
        props.target;
        // @ts-expect-error: iframe navigation does not promise an accessible document.
        props.document;
        frame.title = title;

        return () => frame.removeAttribute("title");
    },

    target: ({data}) => ({tagName: "section", title: data.title}),
    render: ({data}) => data.title,
});

defineContentScriptAppend({
    isolation: {type: "shadow", mode: "closed"},
    prepare: () => ({ready: true}),

    boundary: ({boundary, data}) => {
        const root: ShadowRoot = boundary;
        const ready: boolean = data.ready;
        // @ts-expect-error: a ShadowRoot is not an iframe.
        boundary.src;
        root.host.setAttribute("data-ready", String(ready));
    },

    render: "Shadow",
});

defineRelay({
    init: () => ({ping: () => true}),
    isolation: {type: "iframe", page: "panel"},
    prepare: () => ({height: 240}),

    boundary: ({boundary, data}) => {
        const frame: HTMLIFrameElement = boundary;
        frame.style.height = `${data.height}px`;
        // @ts-expect-error: Relay preserves prepared data.
        data.missing;
    },
});

defineContentScript({
    isolation: {type: "iframe", src: "https://example.com"},
    boundary: ({boundary}) => {
        const frame: HTMLIFrameElement = boundary;
        frame.style.width = "100%";
    },
});

const setup: ContentScriptBoundaryHandler<undefined, "shadow"> = props => {
    const context: ContentScriptBoundaryProps<undefined, "shadow"> = props;
    const root: ShadowRoot = context.boundary;
};

defineContentScript({isolation: "shadow", boundary: setup});
// @ts-expect-error: a callback cannot select the isolation mode.
defineContentScript({boundary: setup});
// @ts-expect-error: there is no boundary without isolation.
defineContentScriptAppend({isolation: {type: "none"}, boundary: () => {}});
// @ts-expect-error: iframe setup cannot consume ShadowRoot props.
defineContentScript({isolation: "iframe", boundary: setup});
// @ts-expect-error: boundary setup is synchronous.
defineContentScript({isolation: "iframe", boundary: async () => {}});
// @ts-expect-error: setup returns cleanup or nothing, not an element.
defineContentScript({isolation: "iframe", boundary: () => document.createElement("div")});
