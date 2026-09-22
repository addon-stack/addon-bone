import React from "react";
import {defineOffscreen, OffscreenReason} from "adnbn";

export default defineOffscreen({
    name: "worker",
    title: "Worker",
    reasons: [OffscreenReason.DOMParser],
    justification: "Integration check of the offscreen view",
    render: ({title}) => <p id="view">React offscreen: {title}</p>,
    init: () => ({
        view: () => ({title: document.title, text: document.getElementById("view")?.textContent ?? null}),
    }),
});
