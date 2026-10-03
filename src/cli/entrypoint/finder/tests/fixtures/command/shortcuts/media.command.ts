import {defineCommand} from "adnbn";

export default defineCommand({
    includeApp: ["media"],
    defaultKey: "MediaPlayPause",
    global: true,
    windowsKey: "MediaNextTrack",
    macKey: "MediaPrevTrack",
    linuxKey: "MediaStop",
    execute() {},
});
