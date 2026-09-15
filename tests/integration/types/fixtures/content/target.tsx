import React from "react";
import {ContentScriptIsolation, defineContentScript, defineContentScriptAppend, defineRelay} from "adnbn";
import type {ContentScriptDefinition, ContentScriptProps, ContentScriptTargetFactory} from "adnbn";
import {Builder as VanillaBuilder} from "adnbn/entry/content/vanilla";
import {Builder as ReactBuilder} from "adnbn/entry/content/react";

defineContentScript({
    isolation: "iframe",
    prepare: async () => ({title: "Frame"}),

    target: ({document, boundary, data, container, anchor}) => {
        const frame: HTMLIFrameElement = boundary;
        const title: string = data.title;
        const doc: Document = document;
        const outer: Element = container;
        const source: Element = anchor;
        // @ts-expect-error: iframe boundaries are not ShadowRoots.
        boundary.host;
        // @ts-expect-error: target data is inferred from prepare.
        data.missing;
        frame.title = title;

        return doc.createElement("section");
    },

    render: ({boundary, data, target}) => {
        const frame: HTMLIFrameElement = boundary;
        const title: string = data.title;
        // @ts-expect-error: render receives the same iframe boundary type.
        boundary.host;

        return <span>{title + target.tagName + frame.title}</span>;
    },
});

defineContentScriptAppend({
    isolation: {type: "shadow", mode: "closed"},
    prepare: () => ({count: 2}),

    target: ({document, boundary, data}) => {
        const root: ShadowRoot = boundary;
        const count: number = data.count;
        // @ts-expect-error: object-form shadow boundaries are not iframe elements.
        boundary.src;
        // @ts-expect-error: data is not any.
        data.missing;

        return {tagName: "span", title: String(count) + root.mode};
    },

    render: ({boundary}) => {
        const root: ShadowRoot = boundary;
        // @ts-expect-error: append render props are contextually typed.
        boundary.src;

        return root.mode;
    },
});

defineContentScript({isolation: ContentScriptIsolation.Shadow, target: "span", render: ({boundary}) => boundary.mode});
defineContentScript({
    isolation: {type: ContentScriptIsolation.Iframe},
    target: {tagName: "section"},
    render: ({boundary}) => boundary.src,
});
defineContentScript({
    render: ({boundary}) => {
        const absent: undefined = boundary;

        return "plain";
    },
});

defineRelay({
    name: "target",
    isolation: {type: "iframe"},
    init: () => ({ping: () => true}),
    prepare: () => ({title: "Relay"}),
    target: ({document, boundary, data}) => {
        const frame: HTMLIFrameElement = boundary;
        const title: string = data.title;
        // @ts-expect-error: Relay preserves boundary inference.
        boundary.host;

        return document.createElement("span");
    },
    render: ({boundary, data}) => boundary.src + data.title,
});

const Panel = ({boundary}: ContentScriptProps<undefined, "shadow">) => <span>{boundary.mode}</span>;
defineContentScript({isolation: "shadow", target: "span", render: Panel});
// @ts-expect-error: selecting a props type does not configure runtime isolation.
defineContentScript<undefined, "shadow">({render: Panel});

const target: ContentScriptTargetFactory<undefined, "shadow"> = ({boundary}) => ({
    tagName: "section",
    title: boundary.mode,
});
const saved: ContentScriptDefinition<undefined, "shadow"> = defineContentScript({
    isolation: "shadow",
    target,
    render: Panel,
});
defineContentScriptAppend({...saved, render: ({boundary}) => boundary.mode});
new VanillaBuilder(saved);
new ReactBuilder(saved);
// @ts-expect-error: a shadow component cannot receive an iframe boundary.
defineContentScript({isolation: "iframe", render: Panel});

defineContentScript({
    isolation: "shadow",
    render: props => {
        // @ts-expect-error: document is supplied to the target factory, not render props.
        props.document;

        return props.target.ownerDocument.createElement("span");
    },
});

// @ts-expect-error: without isolation, target is the container.
defineContentScript({target: "span"});
// @ts-expect-error: explicit none cannot configure a second element.
defineContentScriptAppend({isolation: "none", target: "span"});
// @ts-expect-error: object-form none also forbids a target.
defineContentScript({isolation: {type: "none"}, target: "span"});
// @ts-expect-error: a navigated iframe does not render into a local target.
defineContentScript({isolation: {type: "iframe", src: "https://example.com"}, target: "span"});
// @ts-expect-error: a named page owns its target independently of the content script.
defineContentScriptAppend({isolation: {type: "iframe", page: "panel"}, target: "span"});
// @ts-expect-error: target creation must remain synchronous.
defineContentScript({isolation: "shadow", target: async ({document}) => document.createElement("div")});
// @ts-expect-error: factories cannot return a Promise.
const invalid: ContentScriptTargetFactory = async ({document}) => document.createElement("span");
