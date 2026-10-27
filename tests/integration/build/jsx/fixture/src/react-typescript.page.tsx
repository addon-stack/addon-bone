import React from "react";
import {definePage} from "adnbn";

import {Counter} from "./Counter";

export default definePage({
    title: "TSX page",
    render: ({title}) => <Counter label={title} />,
});
