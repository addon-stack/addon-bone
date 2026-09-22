import {defineOffscreen, definePopup, defineSandbox} from "adnbn";

import type {
    ViewDefinition,
    ViewReactRenderValue,
    ViewRenderHandler,
    ViewRenderReactComponent,
    ViewRenderValue,
    ViewVanillaRenderValue,
} from "adnbn";

type Props = {title?: string};

const Panel: ViewRenderReactComponent<Props> = ({title}) => <span>{title}</span>;

const vanillaValues: ViewVanillaRenderValue[] = [
    document.createElement("div"),
    "text",
    0,
    true,
    false,
    null,
    undefined,
];

const reactValues: ViewReactRenderValue<Props>[] = [Panel, <Panel title="Popup" />, [<span />, "text"]];

const values: ViewRenderValue<Props>[] = [...vanillaValues, ...reactValues];

for (const render of values) {
    const definition: ViewDefinition<Props> = {render};

    definePopup(definition);
}

const handler: ViewRenderHandler<Props> = async ({title}) => title ?? document.createElement("p");

definePopup({render: handler});

definePopup({
    title: "Popup",

    container: props => {
        const title: string | undefined = props.title;

        return {tagName: "section", title: title ?? ""};
    },

    render: async props => {
        // @ts-expect-error: Render handlers receive the view options as props.
        props.missing;

        return props.title ?? "untitled";
    },
});

// Entrypoints that host a view adopt the same render contract.
defineOffscreen({init: () => ({}), render: () => "Offscreen"});
defineSandbox({init: () => ({}), render: <span>Sandbox</span>});

// @ts-expect-error: A Promise is not a render value; await data inside a render handler instead.
definePopup({render: Promise.resolve("text")});

// @ts-expect-error: A plain object is neither a DOM nor a React render value.
definePopup({render: {text: "value"}});
