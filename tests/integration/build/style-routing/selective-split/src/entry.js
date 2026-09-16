import {readContentStyles} from "#adnbn/runtime";

const styles = readContentStyles();
const name = styles ? "shadow" : "normal";
const host = document.createElement("section");
host.id = `selective-${name}`;
const root = styles ? host.attachShadow({mode: "open"}) : host;
const target = document.createElement("div");
target.className = "cascade-probe";
target.textContent = name;
root.append(target);
document.body.append(host);

if (styles) {
    styles.initialize(file => chrome.runtime.getURL(file));
    styles.add(root, target);
}

const button = document.createElement("button");
button.id = `load-${name}`;
button.textContent = `Load ${name}`;
document.body.append(button);
button.addEventListener("click", async () => {
    host.dataset.state = "loading";

    try {
        const order = new URL(location.href).searchParams.get("order");
        const loaded =
            order === "document-first" ? await import("./document-first.js") : await import("./document-last.js");
        const computed = getComputedStyle(target);
        host.dataset.completion = JSON.stringify({
            order: loaded.order,
            color: computed.color,
            border: computed.borderTopWidth,
        });
        host.dataset.state = "loaded";
    } catch (error) {
        host.dataset.state = "error";
        host.dataset.error = String(error);
    }
});
