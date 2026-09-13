import probeAsset from "./probe.svg";
import styles from "./styles.module.css";

export const AsyncProbeValue = "loaded";

export const applyAsyncProbe = (root: HTMLElement): void => {
    root.classList.add(styles.loaded);
    root.dataset.asset = probeAsset;
};
