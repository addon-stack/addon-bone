import {definePlugin} from "@main/plugin";
import {modifyLocaleMessageKey} from "@shared/locale";

export default definePlugin(() => ({
    name: "adnbn:action",
    manifest: ({config, manifest}) => {
        const {action} = config;

        manifest.setAction(action ? {icon: action.icon, title: modifyLocaleMessageKey(action.title)} : undefined);
    },
}));
