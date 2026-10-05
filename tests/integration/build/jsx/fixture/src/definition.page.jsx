import React, {useState} from "react";
import {definePage} from "adnbn";

export default definePage({
    name: "jsx-definition",
    title: "JSX definition",
    matches: ["https://example.com/*"],
    render: ({title}) => {
        const [count, setCount] = useState(0);

        return (
            <button onClick={() => setCount(count + 1)}>
                {title}: {count}
            </button>
        );
    },
});
