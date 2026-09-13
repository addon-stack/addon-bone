import {getEntrypointAssets} from "adnbn";
import "./style.css";

globalThis.readCurrent = () => getEntrypointAssets();
