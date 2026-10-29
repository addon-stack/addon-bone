import {mkdir, writeFile} from "fs/promises";
import path from "path";

export interface ProbeExtensionOptions {
    version: string;
    hubPort: number;
    csp?: string;
}

const serviceWorker = ({
    version,
    hubPort,
}: ProbeExtensionOptions): string => `const VERSION = ${JSON.stringify(version)};
const queue = [];
let socket;

const send = message => {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    } else {
        queue.push(message);
    }
};

chrome.runtime.onMessage.addListener((message, sender) => {
    if (message && message.probe) {
        send({
            type: "hello",
            role: message.role,
            version: message.version,
            tabId: sender.tab && sender.tab.id,
            frameId: sender.frameId,
            documentId: sender.documentId,
            url: sender.url,
        });
    }
});

socket = new WebSocket("ws://127.0.0.1:${hubPort}/dev");
socket.onopen = () => {
    socket.send(JSON.stringify({type: "hello", role: "background", version: VERSION, id: chrome.runtime.id}));
    queue.splice(0).forEach(message => socket.send(JSON.stringify(message)));
};
socket.onmessage = event => {
    const message = JSON.parse(event.data);

    if (message.type === "reloadTabs") {
        message.tabs.forEach(tabId => {
            chrome.tabs.reload(tabId).then(
                () => send({type: "reloaded", tabId}),
                error => send({type: "reloadError", tabId, message: String(error)})
            );
        });
    }
};

chrome.storage.local.get("count").then(({count = 0}) => {
    chrome.storage.local.set({count: count + 1}).then(() => send({type: "storage", version: VERSION, count: count + 1}));
});
`;

const contentScript = ({version}: ProbeExtensionOptions): string => `const VERSION = ${JSON.stringify(version)};
const root = document.documentElement;

root.setAttribute("data-probe-content-" + VERSION, "injected");
chrome.runtime.sendMessage({probe: true, role: "content", version: VERSION});
setInterval(() => {
    const alive = Boolean(globalThis.chrome && chrome.runtime && chrome.runtime.id);

    root.setAttribute("data-probe-alive-" + VERSION, String(alive));
}, 100);
`;

/**
 * Writes a hand-written MV3 extension that reports its lifecycle to the probe hub. It is independent of the adnbn
 * build so the probes record platform behaviour only.
 */
export const writeProbeExtension = async (directory: string, options: ProbeExtensionOptions): Promise<void> => {
    const manifest = {
        manifest_version: 3,
        name: "adnbn dev probe",
        version: "1.0.0",
        permissions: ["storage"],
        background: {service_worker: "sw.js"},
        options_page: "options.html",
        content_scripts: [{matches: ["http://127.0.0.1/*"], js: ["content.js"]}],
        ...(options.csp ? {content_security_policy: {extension_pages: options.csp}} : {}),
    };

    await mkdir(directory, {recursive: true});
    await writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest, null, 2));
    await writeFile(path.join(directory, "sw.js"), serviceWorker(options));
    await writeFile(path.join(directory, "content.js"), contentScript(options));
    await writeFile(
        path.join(directory, "options.html"),
        `<!doctype html><title>Probe options</title><script src="options.js"></script>`
    );
    await writeFile(
        path.join(directory, "options.js"),
        `chrome.runtime.sendMessage({probe: true, role: "options", version: ${JSON.stringify(options.version)}});`
    );
};

/** Writes an extension whose service worker throws while evaluating its top level. */
export const writeThrowingExtension = async (directory: string, message: string): Promise<void> => {
    const manifest = {
        manifest_version: 3,
        name: "adnbn dev throwing probe",
        version: "1.0.0",
        background: {service_worker: "sw.js"},
    };

    await mkdir(directory, {recursive: true});
    await writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest, null, 2));
    await writeFile(path.join(directory, "sw.js"), `throw new Error(${JSON.stringify(message)});`);
};
