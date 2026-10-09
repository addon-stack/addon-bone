import React from "react";

import {AccountSettings} from "./account.options";

interface SettingsFormProps {
    label: string;
}

export const SettingsForm = ({label}: SettingsFormProps) => (
    <main className="settings-form">
        <h1>{label}</h1>
        <AccountSettings />
    </main>
);
