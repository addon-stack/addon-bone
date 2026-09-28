import {defineConfig} from "adnbn";

export default defineConfig({
    name: "Build session lifecycle",
    version: "1.0.0",
    plugins: [
        {
            name: "session-lifecycle",
            async startup() {
                if (process.env.ADNBN_SESSION_CASE === "error") {
                    throw new Error("Session config failed", {cause: new Error("Original config cause")});
                }

                if (process.env.ADNBN_SESSION_CASE === "hang") {
                    process.send?.({started: true});
                    await new Promise(() => {});
                }

                if (process.env.ADNBN_SESSION_CASE === "exit") {
                    process.exit(9);
                }
            },
        },
    ],
});
