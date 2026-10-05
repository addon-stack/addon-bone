import React, {useState} from "react";

export const name = "jsx-named";
export const title = "JSX named";

export default function NamedPage({title}) {
    const [count, setCount] = useState(0);

    return (
        <button onClick={() => setCount(count + 1)}>
            {title}: {count}
        </button>
    );
}
