import catalogue from "./dynamic-messages.json";

export {catalogue as default};
export const lang = "en";
export const keys = ["greeting", "items"];
export const languages = ["en", "fr", "ar"];

export interface Structure {
    greeting: {plural: false; substitutions: ["name"]};
    items: {plural: true; substitutions: ["count"]};
}
