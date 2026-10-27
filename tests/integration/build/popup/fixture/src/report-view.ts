export const reportView = (alias: string, title?: string): HTMLElement => {
    chrome.runtime.sendMessage({kind: "popup-view", alias, documentTitle: document.title, propTitle: title});
    const element = document.createElement("h1");
    element.textContent = title ?? "";

    return element;
};
