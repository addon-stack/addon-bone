import * as api from "adnbn";
import * as entry from "adnbn/entry/relay";
import {Builder as ContentBuilder} from "adnbn/entry/content/vanilla";
import {Builder as ReactContentBuilder} from "adnbn/entry/content/react";

const definition = api.defineRelay({
    name: "scanner",
    allFrames: api.RelayAllFrames.All,
    method: api.RelayMethod.Scripting,
    init: () => ({scan: (text: string) => text.length}),
});

new entry.Builder(definition, ContentBuilder);

const preparedDefinition = api.defineRelay({
    name: "scanner",
    init: () => ({scan: (text: string) => text.length}),
    prepare: async () => ({title: "Prepared"}),

    render: ({data}) => {
        const title: string = data.title;
        // @ts-expect-error: Runtime constructors preserve the inferred prepare data.
        data.missing;

        return title;
    },
});

const preparedBuilder = new entry.Builder(preparedDefinition, ContentBuilder);
entry.default(preparedDefinition, ContentBuilder);

const unresolved: entry.RelayUnresolvedDefinition<ReturnType<typeof definition.init>> = {};
new entry.Builder(unresolved, ContentBuilder);
entry.default(entry.resolveDefinition({default: definition}, "scanner"), ContentBuilder);

type PreparedData = {title: string};
type Scanner = ReturnType<typeof definition.init>;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type PreparedBuilder = Expect<Equal<typeof preparedBuilder, entry.Builder<Scanner, PreparedData, "none">>>;

new entry.Builder(preparedDefinition, ReactContentBuilder);
entry.default(preparedDefinition, ReactContentBuilder);

class ShadowBuilder extends ContentBuilder<PreparedData, "shadow"> {}

const shadowDefinition = api.defineRelay({
    name: "shadow",
    init: definition.init,
    isolation: "shadow",
    prepare: () => ({title: "Shadow"}),
    container: {tagName: "input", value: "initial"},
    render: ({data}) => data.title,
});

new entry.Builder(shadowDefinition, ShadowBuilder);
entry.default(shadowDefinition, ShadowBuilder);

const partial: entry.RelayUnresolvedDefinition<Scanner, PreparedData, "shadow"> = {
    isolation: "shadow",
    prepare: shadowDefinition.prepare,
};

new entry.Builder(partial, ShadowBuilder);
entry.default(partial, ShadowBuilder);

// Inference is checked above; explicit arguments keep rejection checks from exploring fallback inference candidates.
// @ts-expect-error: A specialized adapter cannot receive a different isolation mode.
new entry.Builder<Scanner, PreparedData, "none">(preparedDefinition, ShadowBuilder);
// @ts-expect-error: Bootstrap preserves the same adapter isolation constraint.
entry.default<Scanner, PreparedData, "none">(preparedDefinition, ShadowBuilder);

class NumericBuilder extends ContentBuilder<number, "none"> {}

// @ts-expect-error: The adapter must accept the data produced by prepare.
new entry.Builder<Scanner, PreparedData, "none">(preparedDefinition, NumericBuilder);
// @ts-expect-error: Bootstrap must not erase the prepared data contract.
entry.default<Scanner, PreparedData, "none">(preparedDefinition, NumericBuilder);

new entry.Builder(
    {
        init: definition.init,
        prepare: () => ({title: "Inline"}),

        render: ({data}) => {
            // @ts-expect-error: Inline definitions still infer the prepare result.
            data.missing;

            return data.title;
        },
    },
    ContentBuilder
);

// @ts-expect-error: Container properties remain specific to the selected HTML tag.
api.defineRelay({name: "invalid-tag", init: definition.init, container: {tagName: "div", href: "https://example.com"}});
// @ts-expect-error: Container options do not accept DOM methods.
api.defineRelay({name: "invalid-method", init: definition.init, container: {tagName: "input", focus: () => {}}});
