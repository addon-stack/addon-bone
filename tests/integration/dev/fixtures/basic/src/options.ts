import {defineOptions} from "adnbn";

export default defineOptions({
    title: "Dev Basic Options",
    render() {
        const main = document.createElement("main");

        main.dataset.testid = "dev-basic-options";
        main.textContent = "Dev basic options";

        return main;
    },
});
