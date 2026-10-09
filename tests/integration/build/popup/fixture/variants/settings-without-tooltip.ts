export const title = "Settings document";
export const apply = false;

export default (props: {title?: string}) => {
    chrome.runtime.sendMessage({
        kind: "popup-view",
        alias: "settings",
        documentTitle: document.title,
        propTitle: props.title,
    });
    const element = document.createElement("h1");
    element.textContent = props.title ?? "";

    return element;
};
