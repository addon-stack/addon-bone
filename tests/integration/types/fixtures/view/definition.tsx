import {createPortal} from "react-dom";
import type {FC} from "react";
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

const reactValues: ViewReactRenderValue<Props>[] = [
    Panel,
    <Panel title="Popup" />,
    <>fragment</>,
    [<span key="span" />, "text"],
    createPortal(<span />, document.body),
    42n,
];

const values: ViewRenderValue<Props>[] = [...vanillaValues, ...reactValues];

for (const render of values) {
    const definition: ViewDefinition<Props> = {render};

    definePopup(definition);
}

const handler: ViewRenderHandler<Props> = ({title}) => title ?? document.createElement("p");

definePopup({render: handler});

definePopup({
    title: "Popup",

    container: async props => {
        const title: string | undefined = props.title;

        return {tagName: "section", title: title ?? ""};
    },

    render: props => {
        // @ts-expect-error: Render handlers receive the view options as props.
        props.missing;

        return props.title ?? "untitled";
    },
});

// Entrypoints that host a view adopt the same render contract.
defineOffscreen({init: async () => ({}), main: async () => {}, render: () => "Offscreen"});
defineSandbox({init: async () => ({}), main: async () => {}, render: <span>Sandbox</span>});

defineOffscreen({
    permissions: ["clipboardRead"],
    optionalPermissions: ["clipboardWrite"],
    hostPermissions: ["https://api.example.com/*"],
    optionalHostPermissions: ["https://optional.example.com/*"],
    csp: {sources: {connect: ["https://api.example.com"]}},
    init: options => ({hosts: options.hostPermissions ?? []}),
    main: (instance, options) => {
        const hosts: string[] = instance.hosts;
        const optionalHosts: string[] | undefined = options.optionalHostPermissions;
    },
    render: props => props.permissions?.join(", "),
});

// @ts-expect-error: Sandbox does not adopt the permissions contract.
defineSandbox({permissions: ["storage"], init: () => ({})});

const emptyHandler: ViewRenderHandler<Props> = () => {};
definePopup({render: emptyHandler});

// @ts-expect-error: Render handlers return their value synchronously.
const asyncHandler: ViewRenderHandler<Props> = async () => "text";

// @ts-expect-error: Returning a Promise is also invalid without an async modifier.
const promiseHandler: ViewRenderHandler<Props> = () => Promise.resolve("text");

// @ts-expect-error: A handler that returns no content must still be synchronous.
const asyncEmptyHandler: ViewRenderHandler<Props> = async () => {};

// @ts-expect-error: View components are synchronous client components.
const AsyncPanel: ViewRenderReactComponent<Props> = async ({title}) => <span>{title}</span>;

// @ts-expect-error: The component branch must not allow async render through a define helper.
definePopup({render: async () => <span>Async</span>});

const WidePanel: FC<Props> = Panel;

// @ts-expect-error: React 19 FC can return a Promise, so it does not guarantee synchronous rendering.
definePopup({render: WidePanel});

definePopup({render: props => <WidePanel {...props} />});

// @ts-expect-error: A Promise is not a render value; load data separately from render.
definePopup({render: Promise.resolve("text")});

// @ts-expect-error: A plain object is neither a DOM nor a React render value.
definePopup({render: {text: "value"}});
