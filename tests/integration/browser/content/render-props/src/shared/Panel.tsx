import React, {useLayoutEffect, useState} from "react";
import {createPortal} from "react-dom";
import type {ContentScriptProps} from "adnbn";

const targets = new WeakMap<Element, number>();
let nextTarget = 0;

export function Panel({
    anchor,
    container,
    boundary,
    target,
    data,
}: ContentScriptProps<{label: string; allowed: boolean}>) {
    const [count, setCount] = useState(0);

    useLayoutEffect(() => {
        if (!targets.has(target)) {
            targets.set(target, ++nextTarget);
        }

        container.setAttribute("data-host", data.label);
        const root = target.getRootNode();
        const shadow = root instanceof ShadowRoot;

        anchor.setAttribute(
            "data-snapshot",
            JSON.stringify({
                label: data.label,
                count,
                containerConnected: container.isConnected,
                targetConnected: target.isConnected,
                same: container === target,
                shadow,
                closed: shadow && container.shadowRoot === null,
                frame: target.ownerDocument !== anchor.ownerDocument,
                boundaryMatches: shadow
                    ? boundary === root
                    : !!boundary && "contentDocument" in boundary && boundary.contentDocument === target.ownerDocument,
                frameTitle: boundary && "title" in boundary ? boundary.title : undefined,
                frameHeight: boundary && "style" in boundary ? boundary.style.height : undefined,
                targetTag: target.tagName,
                targetClass: target.className,
                portal: target.querySelector("[data-portal]")?.textContent,
                targetId: targets.get(target),
            })
        );
    }, [anchor, container, boundary, target, data, count]);

    return (
        <>
            <button onClick={() => setCount(value => value + 1)}>{count}</button>
            {createPortal(<span data-portal>{data.label}</span>, target)}
        </>
    );
}
