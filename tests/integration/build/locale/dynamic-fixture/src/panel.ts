import {DynamicLocale, type Language, type LocaleStorageDriver} from "adnbn/locale";

export const createPanel = (context: string, storage?: LocaleStorageDriver | false): HTMLElement => {
    const locale = new DynamicLocale(storage);
    const panel = document.createElement("div");
    panel.dataset.localeContext = context;
    const select = document.createElement("select");
    for (const [language, name] of locale.langNames()) select.add(new Option(name, language));
    const message = document.createElement("p");
    const update = () => {
        select.value = locale.lang();
        message.textContent = locale.trans("greeting");
        panel.dataset.language = locale.lang();
    };
    select.addEventListener("change", () => {
        const saved = locale.change(select.value as Language);
        update();
        void saved.catch(console.error);
    });
    update();
    if (storage !== false) {
        void locale.sync().then(update).catch(console.error);
        const stop = locale.watch(update);
        window.addEventListener("pagehide", stop, {once: true});
    }
    panel.append(select, message);
    return panel;
};
