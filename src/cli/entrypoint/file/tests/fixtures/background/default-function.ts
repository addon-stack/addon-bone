import {Browser} from "adnbn";

import {APP_NAME} from "./config-for-test";

console.log("test background");

export const persistent = true;

export const excludeBrowser = [Browser.Edge];

export const excludeApps = [APP_NAME];

export default async () => {
    console.log("test background main");
};
