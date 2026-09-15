import {ContentScriptAppend, ContentScriptIsolation, defineContentScript, defineContentScriptAppend} from "adnbn";

import type {
    ContentScriptDefinition,
    ContentScriptProps,
    ContentScriptReactRenderValue,
    ContentScriptRenderHandler,
    ContentScriptRenderReactComponent,
    ContentScriptRenderValue,
    ContentScriptVanillaRenderValue,
} from "adnbn";

const Panel: ContentScriptRenderReactComponent = props => <span>{props.anchor.tagName}</span>;

const vanillaValues: ContentScriptVanillaRenderValue[] = [
    document.createElement("div"),
    "text",
    0,
    true,
    false,
    null,
    undefined,
];

const reactValues: ContentScriptReactRenderValue[] = [
    Panel,
    <Panel
        anchor={document.body}
        container={document.body}
        target={document.body}
        data={undefined}
        boundary={undefined}
    />,
    [<span />, "text"],
];

const values: ContentScriptRenderValue[] = [...vanillaValues, ...reactValues];

for (const render of values) {
    const definition: ContentScriptDefinition = defineContentScript({render});
    defineContentScriptAppend({...definition, append: ContentScriptAppend.Last});
}

defineContentScript({
    anchor: ".product",
    isolation: ContentScriptIsolation.Shadow,

    container: props => {
        const anchor: Element = props.anchor;
        // @ts-expect-error: Container factories receive the shared Content props.
        props.missing;

        return {tagName: "section", title: anchor.tagName};
    },

    render: props => {
        const anchor: Element = props.anchor;
        // @ts-expect-error: Vanilla handlers retain contextual props.
        props.missing;
        const element = document.createElement("div");
        element.textContent = anchor.tagName;

        return element;
    },
});

defineContentScriptAppend({
    anchor: ".product",
    append: ContentScriptAppend.After,
    isolation: {type: ContentScriptIsolation.Iframe},

    render: props => {
        const sharedProps: ContentScriptProps = props;
        // @ts-expect-error: React handlers receive the same typed anchor.
        const anchor: number = props.anchor;

        return <Panel {...sharedProps} />;
    },
});

const render: ContentScriptRenderHandler = props => <Panel {...props} />;
defineContentScript({render});
defineContentScriptAppend({render, container: "article"});

defineContentScript({isolation: {type: "iframe", src: "https://example.com"}});
defineContentScriptAppend({isolation: {type: "iframe", page: "panel"}});

// @ts-expect-error: A frame navigating to a URL cannot also render local UI.
defineContentScript({isolation: {type: "iframe", src: "https://example.com"}, render: Panel});
// @ts-expect-error: The append definition preserves the page-navigation restriction.
defineContentScriptAppend({isolation: {type: "iframe", page: "panel"}, render: document.createElement("div")});
// @ts-expect-error: A frame must choose either a page or a URL.
defineContentScript({isolation: {type: "iframe", page: "panel", src: "https://example.com"}});
// @ts-expect-error: The wide render contract still rejects unsupported object shapes.
defineContentScript({render: {unsupported: true}});
