import {
    ContentScriptIsolation,
    ContentScriptShadowMode,
    type ContentScriptIsolationOptions,
    type ContentScriptDefinition,
    getPageUrl,
    defineRelay,
    defineContentScriptAppend,
} from "adnbn";

const page: ContentScriptDefinition = {isolation: {type: "iframe", page: "panel"}};
const frame: ContentScriptDefinition = {
    isolation: {type: ContentScriptIsolation.Iframe, height: 200},
    render: "UI",
};
const shadow: ContentScriptIsolationOptions = {type: "shadow", mode: ContentScriptShadowMode.Closed};
defineContentScriptAppend({isolation: shadow, render: "UI"});
defineContentScriptAppend({isolation: "shadow", render: "UI"});
defineContentScriptAppend({isolation: ContentScriptIsolation.Iframe, render: "UI"});
defineContentScriptAppend({isolation: {type: "shadow", mode: "open"}});
defineContentScriptAppend({isolation: {type: "shadow"}});
defineContentScriptAppend({isolation: {type: "none"}, render: "UI"});
defineContentScriptAppend({isolation: {type: "iframe", src: "https://example.com"}});

// @ts-expect-error isolation options need a discriminator
defineContentScriptAppend({isolation: {mode: "closed"}});
// @ts-expect-error embedded pages own their renderer
const render: ContentScriptDefinition = {isolation: {type: "iframe", page: "panel"}, render: "UI"};
// @ts-expect-error source variants are mutually exclusive
const both: ContentScriptDefinition = {isolation: {type: "iframe", page: "panel", src: "https://example.com"}};
// @ts-expect-error generated registry rejects an unknown page inside another public type
const unknown: ContentScriptDefinition = {isolation: {type: "iframe", page: "missing"}};
// @ts-expect-error generated registry also narrows the getter
getPageUrl("missing");
// @ts-expect-error browser mode is closed, not close
defineContentScriptAppend({isolation: {type: "shadow", mode: "close"}});
// @ts-expect-error dimensions belong to iframe
defineContentScriptAppend({isolation: {type: "shadow", height: 200}});
// @ts-expect-error Shadow mode is not an iframe option
defineContentScriptAppend({isolation: {type: "iframe", mode: "closed"}});
const misplaced = {type: ContentScriptIsolation.None, page: "panel"} as const;
// @ts-expect-error disallowed options are rejected even through an intermediate variable
defineContentScriptAppend({isolation: misplaced});
const navigation = {type: ContentScriptIsolation.Iframe, src: "https://example.com"} as const;
// @ts-expect-error inferred object variables do not bypass the render prohibition
defineContentScriptAppend({isolation: navigation, render: "UI"});
void [page, frame, render, both, unknown];

defineRelay({isolation: "iframe", init: () => ({})});
defineRelay({isolation: shadow, render: "UI", init: () => ({})});
defineRelay({isolation: {type: "iframe", page: "panel"}, init: () => ({})});
// @ts-expect-error Relay uses the same discriminator rules
defineRelay({isolation: {type: "iframe", mode: "closed"}, init: () => ({})});
// @ts-expect-error embedded Relay pages own their renderer
defineRelay({isolation: {type: "iframe", page: "panel"}, render: "UI", init: () => ({})});
// @ts-expect-error Relay page/src variants are exclusive
defineRelay({isolation: {type: "iframe", page: "panel", src: "https://example.com"}, init: () => ({})});
