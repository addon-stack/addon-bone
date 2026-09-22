import React from "react";
import {defineSandbox} from "adnbn";

export default defineSandbox({
    name: "frame",
    title: "Frame",
    render: ({title}) => <p id="view">React sandbox: {title}</p>,
    init: () => ({
        view: () => ({title: document.title, text: document.getElementById("view")?.textContent ?? null}),
    }),
});
