import {defineBackground, getRelay} from "adnbn";

export default defineBackground({
    main() {
        chrome.runtime.onMessage.addListener((message, _sender, respond) => {
            if (message.type === "prepare-data") {
                respond({label: message.label, allowed: message.allowed});
            }
        });

        const started = new Set<number>();

        function run(tabId: number, url?: string) {
            if (!url?.startsWith("http://127.0.0.1:") || started.has(tabId)) {
                return;
            }

            started.add(tabId);

            void (async () => {
                const relay = getRelay("propsProbe", tabId);
                const start = Date.now();

                while (Date.now() - start < 15000) {
                    try {
                        const result = await relay.status();
                        await relay.report(result);

                        if (result.ready) {
                            return;
                        }
                    } catch {
                        /* Wait until the declarative Relay is registered. */
                    }

                    await new Promise(resolve => setTimeout(resolve, 20));
                }

                throw new Error("Prepared Relay did not become ready");
            })().catch(error => console.error(error));
        }

        chrome.tabs.onUpdated.addListener((id, change, tab) => {
            if (change.status === "complete") {
                run(id, tab.url);
            }
        });

        void chrome.tabs.query({}).then(tabs =>
            tabs.forEach(tab => {
                if (tab.id !== undefined) {
                    run(tab.id, tab.url);
                }
            })
        );
    },
});
