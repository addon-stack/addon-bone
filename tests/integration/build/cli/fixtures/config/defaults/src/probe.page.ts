import {definePage} from "adnbn";
import styles from "./probe.module.css";

export default definePage({
    render: () => {
        const element = document.createElement("div");
        element.className = styles.probe;

        return element;
    },
});
