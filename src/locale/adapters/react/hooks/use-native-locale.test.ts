jest.mock("@addon-core/browser", () => ({getI18nMessage: jest.fn()}));
jest.mock("#adnbn/locale", () => ({
    keys: Object.keys(require("./tests/fixtures/native-messages.json")).map(key => key.replaceAll("_", ".")),
    languages: ["en", "fr"],
}));

import {createElement, createRef, StrictMode, useState} from "react";
import {createPortal} from "react-dom";
import {cleanup, fireEvent, render, renderHook} from "@testing-library/react";
import {getI18nMessage} from "@addon-core/browser";
import {useNativeLocale, type LocaleReactContract} from "../index";
import {NativeLocale} from "@locale/providers";
import {Language, LocaleDir} from "@typing/locale";
import messages from "./tests/fixtures/native-messages.json";

interface Structure {
    "app.title": {plural: false; substitutions: []};
    "app.greeting": {plural: false; substitutions: ["name"]};
    "app.action": {plural: false; substitutions: ["action"]};
    "app.items": {plural: true; substitutions: ["count"]};
    "app.literal": {plural: false; substitutions: ["name"]};
    "app.empty": {plural: false; substitutions: []};
    "app.missing": {plural: false; substitutions: []};
}

// Runtime fixtures have their own keys; generated-registry fixtures verify the inferred public hook type.
const useFixtureLocale = () => useNativeLocale() as LocaleReactContract<Structure>;

describe("useNativeLocale", () => {
    beforeEach(() => {
        jest.mocked(getI18nMessage).mockImplementation(key => messages[key as keyof typeof messages] ?? "");
    });

    afterEach(() => {
        cleanup();
        jest.restoreAllMocks();
    });

    test("works without a Provider and shares the existing native singleton across roots", () => {
        const native = NativeLocale.getInstance();
        const read = jest.spyOn(native, "get");
        const first = renderHook(useFixtureLocale, {wrapper: StrictMode});
        const second = renderHook(useFixtureLocale);
        const initial = first.result.current;

        expect(initial.lang).toBe(Language.English);
        expect([...initial.langs]).toEqual([Language.English, Language.French]);
        expect(initial.langNames).toEqual(
            new Map([
                [Language.English, "English"],
                [Language.French, "Français"],
            ])
        );
        expect([...initial.langs]).toEqual([...native.langs()]);
        expect([...initial.langNames]).toEqual([...native.langNames()]);
        expect(initial.dir).toBe(LocaleDir.LeftToRight);
        expect(initial.isRtl).toBe(false);
        expect(initial).not.toHaveProperty("change");
        expect(initial.t("app.title")).toBe("Native title");
        expect(second.result.current.t("app.title")).toBe("Native title");
        expect(read).toHaveBeenCalledTimes(2);

        first.rerender();
        expect(first.result.current).toBe(initial);
    });

    test("returns strings for text and numeric substitutions, selecting plurals before replacement", () => {
        const {result} = renderHook(useFixtureLocale);
        expect(result.current.t("app.greeting", {name: "Ada"})).toBe("Hello Ada! Again: Ada.");
        expect(result.current.choice("app.items", 1, {count: 1})).toBe("1 item");
        expect(result.current.choice("app.items", 2, {count: 0})).toBe("0 items");
        expect(result.current.choice("app.items", 2, {count: "one|two"})).toBe("one|two items");
    });

    test("renders repeated JSX placeholders without adding DOM wrappers", () => {
        const warn = jest.spyOn(console, "error").mockImplementation();
        const Greeting = () => {
            const {t} = useFixtureLocale();
            return createElement("p", null, t("app.greeting", {name: createElement("strong", null, "Ada")}));
        };
        const {container} = render(createElement(Greeting));
        expect(container.innerHTML).toBe("<p>Hello <strong>Ada</strong>! Again: <strong>Ada</strong>.</p>");
        expect(warn).not.toHaveBeenCalled();
    });

    test("preserves component state, event handlers and refs across parent renders", () => {
        const button = createRef<HTMLButtonElement>();
        const Counter = () => {
            const [count, setCount] = useState(0);
            return createElement("button", {ref: button, onClick: () => setCount(count + 1)}, String(count));
        };
        const Action = () => {
            const {t} = useFixtureLocale();
            return createElement("p", null, t("app.action", {action: createElement(Counter)}));
        };
        const {getByRole, rerender, unmount} = render(createElement(Action));
        const element = getByRole("button");
        expect(button.current).toBe(element);
        fireEvent.click(element);
        rerender(createElement(Action));
        expect(getByRole("button")).toBe(element);
        expect(element.textContent).toBe("1");
        unmount();
        expect(button.current).toBeNull();
    });

    test("selects the plural with the numeric count while displaying a React node", () => {
        const Items = () => {
            const {choice} = useFixtureLocale();
            return createElement("p", null, choice("app.items", 2, {count: createElement("span", null, "many|more")}));
        };
        const {container} = render(createElement(Items));
        expect(container.innerHTML).toBe("<p><span>many|more</span> items</p>");
    });

    test("supports empty nodes, arrays and portals as substitutions", () => {
        const portal = document.createElement("aside");
        const {result} = renderHook(useFixtureLocale);
        const {container, rerender} = render(createElement("p", null, result.current.t("app.action", {action: null})));
        expect(container.textContent).toBe("Open ");
        for (const action of [false, undefined]) {
            rerender(createElement("p", null, result.current.t("app.action", {action})));
            expect(container.textContent).toBe("Open ");
        }
        rerender(
            createElement(
                "p",
                null,
                result.current.t("app.action", {
                    action: ["the ", createElement("b", {key: "label"}, "panel")],
                })
            )
        );
        expect(container.innerHTML).toBe("<p>Open the <b>panel</b></p>");
        rerender(
            createElement(
                "p",
                null,
                result.current.t("app.action", {
                    action: createPortal(createElement("b", null, "panel"), portal),
                })
            )
        );
        expect(container.textContent).toBe("Open ");
        expect(portal.innerHTML).toBe("<b>panel</b>");
    });

    test("treats HTML and malformed placeholders as text", () => {
        const {result} = renderHook(useFixtureLocale);
        const {container} = render(
            createElement(
                "p",
                null,
                result.current.t("app.literal", {
                    name: createElement("span", null, "Ada"),
                })
            )
        );
        expect(container.textContent).toBe("<b>Ada</b> {{}} {{   }} {{broken} {broken}}");
        expect(container.querySelector("b")).toBeNull();
        expect(container.querySelector("span")?.textContent).toBe("Ada");
    });

    test("preserves empty messages and the existing missing-message and substitution diagnostics", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation();
        const {result} = renderHook(useFixtureLocale);
        expect(result.current.t("app.empty")).toBe("");
        expect(warn).not.toHaveBeenCalled();
        expect(result.current.t("app.missing")).toBe("app.missing");
        expect(warn).toHaveBeenCalledWith('Locale key "app.missing" not found in "en" language.');
        expect(result.current.t("app.greeting", {} as never)).toBe("Hello name! Again: name.");
        expect(warn).toHaveBeenCalledWith(
            'Locale substitution "name" not found for key "app.greeting" in "en" language.'
        );
    });
});
