import styles from "./lazy.module.scss";

export const applyLazyStyle = (element: HTMLElement): void => {
    element.classList.add(styles.loaded);
};
