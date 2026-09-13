import React, {useState} from "react";
import {defineOptions} from "adnbn";

import "./styles.css";

export default defineOptions({
    as: "preferences",
    title: "React Options",
    openInTab: true,
    render() {
        const [count, setCount] = useState(0);

        return (
            <main data-testid="options" data-adapter="react">
                <h1>React settings</h1>
                <output data-testid="count">{count}</output>
                <button data-testid="increment" onClick={() => setCount(value => value + 1)}>
                    Increment
                </button>
            </main>
        );
    },
});
