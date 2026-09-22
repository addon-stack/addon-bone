import {defineHistory} from "adnbn";

import "./styles.css";

export default defineHistory({
    title: "Vanilla History",
    render() {
        const main = document.createElement("main");
        main.dataset.testid = "override";
        main.dataset.adapter = "vanilla";

        const heading = document.createElement("h1");
        heading.textContent = "Vanilla history";

        const count = document.createElement("output");
        count.dataset.testid = "count";
        count.textContent = "0";

        const increment = document.createElement("button");
        increment.dataset.testid = "increment";
        increment.textContent = "Increment";
        increment.addEventListener("click", () => {
            count.textContent = String(Number(count.textContent) + 1);
        });

        main.append(heading, count, increment);

        return main;
    },
});
