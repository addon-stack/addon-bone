import "./host-lazy.css?asis";
import styles from "./lazy.module.css?isolation";
export const apply = (panel: HTMLElement) => panel.classList.add(styles.loaded);
