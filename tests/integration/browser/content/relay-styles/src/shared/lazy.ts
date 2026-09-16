import "./host-lazy.css?unisolated&asis";
import styles from "./lazy.module.css";
export const apply = (panel: HTMLElement) => panel.classList.add(styles.loaded);
