import {definePopup, getOffscreen, getSandbox} from "adnbn";

const collect = async () => ({
    offscreen: await getOffscreen("worker").view(),
    headless: await getOffscreen("plain").view(),
    sandbox: await getSandbox("frame").view(),
});

export default definePopup({
    render: () => {
        const output = document.createElement("output");

        output.id = "result";

        collect().then(
            result => {
                output.value = JSON.stringify(result);
            },
            error => {
                output.value = JSON.stringify({error: error instanceof Error ? error.message : String(error)});
            }
        );

        return output;
    },
});
