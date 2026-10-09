import React from "react";
import {defineOptions} from "adnbn";

import {SettingsForm} from "./SettingsForm";
import {moduleLabel} from "./options";
import "./styles.scss";

export default defineOptions({
    template: "./template.html",
    openInTab: true,
    render: () => <SettingsForm label={moduleLabel} />,
});
