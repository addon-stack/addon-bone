import {createElement} from "react";
import {cleanup, render} from "@testing-library/react";
import CustomLocale from "@locale/providers/CustomLocale";
import {Language, LocaleDir} from "@typing/locale";
import ReactLocale from "./ReactLocale";

interface Structure {
    greeting: {plural: false; substitutions: ["name"]};
    items: {plural: true; substitutions: ["count"]};
}

afterEach(cleanup);

test.each([
    [Language.English, 2, "many"],
    [Language.French, 0, "one"],
    [Language.Japanese, 5, "one"],
    [Language.Russian, 5, "other"],
] as const)("the shared React renderer preserves %s plural rules", (lang, count, expected) => {
    const locale = new ReactLocale<Structure>(
        new CustomLocale<Structure>(lang, {
            items: "{{count}} one|{{count}} many|{{count}} other",
        })
    );
    const {container} = render(
        createElement(
            "p",
            null,
            locale.choice("items", count, {
                count: createElement("b", null, "display"),
            })
        )
    );
    expect(container.innerHTML).toBe(`<p><b>display</b> ${expected}</p>`);
});

test("the shared React contract derives RTL properties and preserves empty plural forms", () => {
    const locale = new ReactLocale<Structure>(new CustomLocale<Structure>(Language.Arabic, {items: "{{count}} zero|"}));
    expect(locale.dir).toBe(LocaleDir.RightToLeft);
    expect(locale.isRtl).toBe(true);
    expect(locale.choice("items", 1, {count: 1})).toBe("");
    expect(locale.choice("items", 3, {count: 3})).toBe("3 zero");
});

test("translation methods remain bound when destructured", () => {
    const {t, choice} = new ReactLocale<Structure>(
        new CustomLocale<Structure>(Language.English, {
            greeting: "Hello {{name}}",
            items: "{{count}} item|{{count}} items",
        })
    );

    expect(t("greeting", {name: "Ada"})).toBe("Hello Ada");
    expect(choice("items", 2, {count: 2})).toBe("2 items");
});
