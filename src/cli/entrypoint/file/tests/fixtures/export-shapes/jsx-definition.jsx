import React, {useState} from "react";
import {definePage} from "adnbn";

export const title = "JSX page";

export default definePage({
    name: "jsx-page",
    matches: ["https://example.com/*"],
    render: () => {
        const [count, setCount] = useState(0);

        return <button onClick={() => setCount(count + 1)}>{count}</button>;
    },
});
