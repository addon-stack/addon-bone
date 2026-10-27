import React, {useState} from "react";
import {definePage} from "adnbn";

function RootPanel() {
    const [count, setCount] = useState(0);

    return <button onClick={() => setCount(count + 1)}>React root runtime: {count}</button>;
}

export default definePage({
    title: "React root page",
    render: RootPanel,
});
