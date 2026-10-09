import {changePopup, defineBackground, getPopups} from "adnbn";
import {
    createTab,
    getActionPopup,
    getActionTitle,
    getI18nMessage,
    getUrl,
    removeTab,
    setActionTitle,
} from "@addon-core/browser";

interface ViewReport {
    kind: "popup-view";
    alias: string;
    documentTitle: string;
    propTitle: string;
}

const views = new Map<string, (report: ViewReport) => void>();

const inspectView = async (alias: "popup" | "settings") => {
    const report = new Promise<ViewReport>(resolve => views.set(alias, resolve));
    const tab = await createTab({url: getUrl(getPopups().get(alias)!.path!), active: false});

    try {
        return await report;
    } finally {
        views.delete(alias);
        await removeTab(tab.id!);
    }
};

const inspect = async (tabId: number) => {
    const initial = await getActionTitle();
    const translated = getI18nMessage("popup_account");
    const initialPopup = await getActionPopup();

    await changePopup("settings");

    const settings = await getActionTitle();

    await changePopup("popup");

    const account = await getActionTitle();

    await setActionTitle("Keep this tab", tabId);
    await changePopup("settings", tabId);

    const tabSettings = await getActionTitle(tabId);
    const tabPath = await getActionPopup(tabId);
    const globalAfterTab = await getActionTitle();

    await changePopup("popup", tabId);

    return {
        initial,
        translated,
        initialPopup,
        settings,
        account,
        tabSettings,
        tabPath,
        globalAfterTab,
        tabAccount: await getActionTitle(tabId),
        entries: Object.fromEntries(getPopups()),
        views: [await inspectView("popup"), await inspectView("settings")],
    };
};

export default defineBackground({
    main() {
        chrome.runtime.onMessage.addListener((message, sender, respond) => {
            if (message.kind === "popup-view") {
                views.get(message.alias)?.(message);
                respond({ok: true});

                return;
            }

            if (message.kind === "inspect-popup") {
                const run = async () => {
                    try {
                        respond(await inspect(sender.tab!.id!));
                    } catch (error) {
                        respond({error: String(error)});
                    }
                };

                void run();

                return true;
            }
        });
    },
});
