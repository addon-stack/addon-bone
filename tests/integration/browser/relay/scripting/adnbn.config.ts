import {defineConfig} from "adnbn";

export default defineConfig({
    name: "Relay scripting protocol",
    version: "1.0.0",
    manifest: {permissions: ["tabs"], host_permissions: ["http://127.0.0.1/*"]},
    specific: {gecko: {id: "relay-scripting@adnbn.test"}},
});
