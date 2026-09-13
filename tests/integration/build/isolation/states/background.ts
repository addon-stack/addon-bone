import {getPages} from "adnbn";

(globalThis as typeof globalThis & {readPages: () => unknown}).readPages = () => Object.fromEntries(getPages());

export default () => {};
