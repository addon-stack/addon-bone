import {definePage} from "adnbn";
import {value} from "./barrel";

export default definePage({
    render: () => {
        const element = document.createElement("div");
        element.textContent = value;

        return element;
    },
});
