import {defineSandbox} from "adnbn";

export default defineSandbox({
    name: "dataSandbox",
    readyTimeout: 1234,
    requestTimeout: 5678,
    removeOnRequestTimeout: false,
    init: () => ({ping: () => true}),
});
