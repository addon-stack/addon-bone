import {defineBackground, getRelay} from "adnbn";

export default defineBackground({
    main() {
        const started = new Set<number>();
        const run = (tabId: number, url?: string) => {
            if (!url?.startsWith("http://127.0.0.1:") || started.has(tabId)) return;
            started.add(tabId);
            void (async () => {
                const shadow = getRelay("shadowPanel", tabId);
                const iframe = getRelay("iframePanel", tabId);
                const control = getRelay("control", tabId);
                const start = Date.now();
                while (true) {
                    try {
                        if ((await shadow.ready()) && (await iframe.ready()) && (await control.pageColor())) break;
                    } catch {
                        /* The browser can finish navigation before declarative scripts start. */
                    }
                    if (Date.now() - start > 10000) throw new Error("Relay panels did not mount");
                    await new Promise(resolve => setTimeout(resolve, 20));
                }
                await control.report({
                    shadow: await shadow.load(),
                    iframe: await iframe.load(),
                    page: await control.pageColor(),
                });
            })().catch(async error => {
                await getRelay("control", tabId)
                    .report({error: String(error)})
                    .catch(() => {});
                console.error("Relay browser probe failed", error);
            });
        };
        chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
            if (change.status === "complete") run(tabId, tab.url);
        });
        // Loading an unpacked MV3 worker can race the first host navigation.
        void chrome.tabs.query({}).then(tabs =>
            tabs.forEach(tab => {
                if (tab.id !== undefined) run(tab.id, tab.url);
            })
        );
    },
});
