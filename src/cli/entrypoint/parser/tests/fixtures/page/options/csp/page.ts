import {CspSource, definePage} from "adnbn";

export default definePage({
    name: "help",
    csp: {
        wasm: true,
        sources: {
            connect: [CspSource.Self, "https://api.example.com"],
            image: [CspSource.Self, CspSource.Data, CspSource.Blob],
            style: [CspSource.Self, CspSource.UnsafeInline],
            worker: [CspSource.Blob],
            frame: ["https://frame.example.com"],
        },
    },
});
