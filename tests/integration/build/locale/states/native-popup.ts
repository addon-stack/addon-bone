import {createElement} from "react";
import {createRoot} from "react-dom/client";
import {definePopup} from "adnbn";
import {useNativeLocale} from "adnbn/locale/react";

function Popup() {
    const {t, choice} = useNativeLocale();
    return createElement(
        "main",
        null,
        t("welcome", {name: createElement("strong", null, "Ada")}),
        choice("items", 2, {count: createElement("span", null, "2")})
    );
}

export default definePopup({
    render: () => {
        const element = document.createElement("div");
        createRoot(element).render(createElement(Popup));
        return element;
    },
});
