import {defineOptions} from "adnbn";
import catalogue from "#adnbn/locale";
import {createPanel} from "./panel";

export default defineOptions({render: () => createPanel(catalogue, "options")});
