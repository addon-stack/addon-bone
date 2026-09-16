import "adnbn/client-types";
import styles from "./styles.module.scss?unisolated";

const name: string = styles.panel;
// @ts-expect-error CSS Modules exports are readonly.
styles.panel = name;
