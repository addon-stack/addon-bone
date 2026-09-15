import type {ContentScriptPrepareProps} from "adnbn";

export async function prepare({anchor}: ContentScriptPrepareProps) {
    await new Promise<void>(resolve => {
        anchor.addEventListener("release", () => resolve(), {once: true});
        anchor.setAttribute("data-preparing", "true");
    });

    const data: {label: string; allowed: boolean} = await chrome.runtime.sendMessage({
        type: "prepare-data",
        label: anchor.id,
        allowed: anchor.id !== "skip",
    });

    return data.allowed ? data : false;
}
