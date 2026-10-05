import {definePage} from "adnbn";

export default definePage({
    title: "Array metadata",
    metas: [
        {attributes: {name: "entry-array", content: "array"}},
        {attributes: {name: "theme-color", content: "#123456"}},
    ],
    render: () => "Array page",
});
