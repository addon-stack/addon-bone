import {RelayAllFrames, type ContentScriptDefinition, type RelayDefinition} from "adnbn";
import {Builder as RelayBuilder, type RelayUnresolvedDefinition} from "adnbn/entry/relay";
import type {TransportType} from "adnbn/transport";
import {Builder as ContentScriptBuilder} from "virtual:content-framework";
import * as definition from "virtual:relay-entrypoint";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type ContentOptions = Expect<Equal<ConstructorParameters<typeof ContentScriptBuilder>[0], ContentScriptDefinition>>;
type RelayOptions = Expect<
    Equal<ConstructorParameters<typeof RelayBuilder>[0], RelayUnresolvedDefinition<TransportType>>
>;
type NamedExports = Expect<
    Equal<Partial<Omit<typeof definition, "default">>, Readonly<RelayUnresolvedDefinition<TransportType>>>
>;
type DefaultExport = Expect<
    Equal<
        typeof definition.default,
        RelayDefinition<TransportType> | RelayDefinition<TransportType>["init"] | undefined
    >
>;

new RelayBuilder({allFrames: RelayAllFrames.All});
new ContentScriptBuilder({allFrames: true});

// @ts-expect-error: The real content constructor requires a boolean, not Relay's response mode.
new ContentScriptBuilder({allFrames: RelayAllFrames.All});
// @ts-expect-error: The real Relay constructor does not accept arbitrary modes.
new RelayBuilder({allFrames: "invalid"});
