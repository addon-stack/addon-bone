import catalogue from "./catalogue.json";

export {catalogue as default};
export const lang = "fr";
export const keys = ["greeting", "items", "app.title", "fallback", "empty", "__proto__"];
export const languages = ["en", "fr", "en_GB"];

export interface Structure {
    greeting: {plural: false; substitutions: ["name"]};
    items: {plural: true; substitutions: ["count"]};
    "app.title": {plural: false; substitutions: []};
    fallback: {plural: false; substitutions: []};
    empty: {plural: false; substitutions: []};
    __proto__: {plural: false; substitutions: []};
}
