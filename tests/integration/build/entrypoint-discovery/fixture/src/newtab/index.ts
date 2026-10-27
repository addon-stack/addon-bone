import {defineNewtab} from "adnbn";

import {moduleLabel} from "../newtabs/account.newtab";
import "./styles.scss";

export default defineNewtab({
    template: "./template.html",
    render: () => moduleLabel,
});
