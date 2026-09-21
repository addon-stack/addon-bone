import React, {useState} from "react";
import {defineNewtab} from "adnbn";

import "./styles.css";

export default defineNewtab({
    as: "dashboard",
    title: "React New Tab",
    render() {
        const [count, setCount] = useState(0);

        return (
            <main data-testid="override" data-adapter="react">
                <h1>React new tab</h1>
                <output data-testid="count">{count}</output>
                <button data-testid="increment" onClick={() => setCount(value => value + 1)}>
                    Increment
                </button>
            </main>
        );
    },
});
