import path from "path";

export const LocaleFixtureDirectory = path.join(ADNBN_TEST_ROOT, "tests/integration/build/locale/chunks-fixture");

export const ReadPanels = `Array.from(document.querySelectorAll('[data-locale-context]'), panel => ({
    context: panel.dataset.localeContext,
    message: panel.querySelector('p').textContent,
})).sort((a, b) => a.context.localeCompare(b.context))`;

export const ChangeLanguage = `(() => {
    for (const select of document.querySelectorAll('[data-locale-context] select')) {
        select.value = 'fr';
        select.dispatchEvent(new Event('change', {bubbles: true}));
    }
})()`;

export const expectPanels = (panels: unknown, contexts: string[], language = "en"): void => {
    expect(panels).toEqual(
        [...contexts].sort().map(context => ({
            context,
            message: language === "en" ? "Hello from the locale chunk fixture" : "Bonjour depuis le catalogue partagé",
        }))
    );
};
