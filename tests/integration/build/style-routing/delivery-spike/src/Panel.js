import {createElement} from "react";
import {getUrl} from "@addon-core/browser";
import {Builder} from "adnbn/entry/content/vanilla";
import styles from "./panel.module.scss";
import "fixture-styles";

export const libraries = {getUrl, Builder};

export function Panel() {
    return createElement("section", {className: styles.panel}, "Shared panel");
}
