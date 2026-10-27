import React, {useState} from "react";

export function Counter({label}) {
    const [count, setCount] = useState(0);

    return (
        <button onClick={() => setCount(count + 1)}>
            {label}: {count}
        </button>
    );
}
