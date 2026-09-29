import {defineConfig, type ActionOptions} from "adnbn";

const action: ActionOptions = {
    icon: "active",
    title: "@action.title",
};

export default defineConfig({
    name: "Action Integration",
    version: "1.0.0",
    icon: "default",
    action,
});
