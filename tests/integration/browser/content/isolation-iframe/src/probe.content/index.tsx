import {observeMounts} from "../shared/events";
import React from "react";
import Panel from "./Panel";
import {ContentScriptIsolation, ContentScriptAppend, ContentScriptWorld, defineContentScriptAppend} from "adnbn";

import "./fonts.css?isolation&asis";

let instance = 0;

export default defineContentScriptAppend({
    main: observeMounts,
    matches: ["http://127.0.0.1/*"],
    world: ContentScriptWorld.Isolated,
    runAt: "document_end",
    allFrames: true,
    anchor: "[data-shadow-primary]",
    append: ContentScriptAppend.Last,
    watch: true,
    isolation: ContentScriptIsolation.Iframe,
    container: ({anchor}) => {
        const host = document.createElement("section");
        host.dataset.shadowProbe = "primary";
        host.dataset.anchor = anchor.getAttribute("data-shadow-primary") ?? "unknown";
        host.dataset.instance = String(++instance);

        return host;
    },
    render: ({anchor}) => <Panel anchor={anchor} />,
});
