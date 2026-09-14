import probeAsset from "./probe.svg";
import styles from "./styles.module.css";

export const asyncProbeValue = "loaded";

export const applyAsyncProbe = (root: HTMLElement): void => {
    root.classList.add(styles.loaded);
    root.dataset.asset = probeAsset;
};
