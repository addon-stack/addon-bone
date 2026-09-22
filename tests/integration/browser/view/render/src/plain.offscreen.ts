export const reasons = ["DOM_PARSER"];

export const justification = "Integration check of a headless offscreen";

// Without a render the view creates no container: only the page scripts stay in the body.
export default () => ({
    view: () => ({containers: document.body.querySelectorAll(":scope > :not(script)").length}),
});
