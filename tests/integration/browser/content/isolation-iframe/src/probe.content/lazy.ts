import styles from "./lazy.module.css";

export const applyLazyStyle = (element: HTMLElement): void => {
    element.classList.add(styles.loaded);
};
