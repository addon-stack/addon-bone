import {definePopup} from "adnbn";
import catalogue from "#adnbn/locale";
import {createPanel} from "./panel";

export default definePopup({render: () => createPanel(catalogue, "popup")});
