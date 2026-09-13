export const createPanel = (catalogue: Record<string, Record<string, string>>, context: string): HTMLElement => {
    const panel = document.createElement("div");
    panel.dataset.localeContext = context;
    const select = document.createElement("select");
    for (const language of Object.keys(catalogue)) select.add(new Option(language, language));
    const message = document.createElement("p");
    const update = () => (message.textContent = catalogue[select.value].greeting);
    select.addEventListener("change", update);
    update();
    panel.append(select, message);
    return panel;
};
