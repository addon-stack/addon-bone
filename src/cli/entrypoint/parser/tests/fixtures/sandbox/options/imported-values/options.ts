import {SandboxAllow, SandboxSource} from "adnbn";

enum LocalSandboxSource {
    Data = "data:",
}

export const sandboxName = "importedOptions";
export const readyTimeout = 500;
export const requestTimeout = 1500;
export const sandboxCsp = {
    eval: true,
    inline: true,
    allow: [SandboxAllow.Popups, "downloads"],
    sources: {
        image: [LocalSandboxSource.Data, SandboxSource.Blob],
        connect: [SandboxSource.Self],
    },
};
