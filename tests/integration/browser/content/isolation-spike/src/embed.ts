// MAIN has no extension APIs. The isolated version supplies only its own page URL.
const pageUrl =
    typeof chrome !== "undefined" && chrome.runtime?.getURL ? chrome.runtime.getURL("panel.html") : undefined;
const world = pageUrl ? "isolated" : "main";
for (const kind of ["allowed", "csp-blocked", "xfo-blocked", ...(pageUrl ? ["page"] : [])]) {
    const frame = document.createElement("iframe");
    frame.dataset.embedProbe = `${world}-${kind}`;
    const expected = `${world}-${kind}`;
    window.addEventListener("message", event => {
        if (event.source === frame.contentWindow && event.data === expected) frame.dataset.loaded = "true";
    });
    frame.src = (kind === "page" ? pageUrl! : location.origin + "/" + kind + ".html") + "#" + expected;
    document.body.append(frame);
}
