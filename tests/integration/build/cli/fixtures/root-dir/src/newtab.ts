import {defineNewtab} from "adnbn";

import {title} from "./title";
import {source, markup} from "@/values";

export default defineNewtab({
    title,
    csp: {sources: {connect: [source]}},
    render: markup,
});
