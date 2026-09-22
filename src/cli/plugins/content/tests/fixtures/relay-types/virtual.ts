import {RelayAllFrames, type ContentScriptDefinition} from "adnbn";
import relay, {Builder as RelayBuilder, resolveDefinition, type RelayUnresolvedDefinition} from "adnbn/entry/relay";
import type {TransportType} from "adnbn/transport";
import {Builder as ContentScriptBuilder} from "virtual:content-builder";
import * as definition from "virtual:relay-entrypoint";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type ContentOptions = Expect<Equal<ConstructorParameters<typeof ContentScriptBuilder>[0], ContentScriptDefinition>>;
type RelayOptions = Expect<
    Equal<ConstructorParameters<typeof RelayBuilder>[0], RelayUnresolvedDefinition<TransportType>>
>;

new RelayBuilder({allFrames: RelayAllFrames.All}, ContentScriptBuilder);
new ContentScriptBuilder({allFrames: true});
relay(resolveDefinition(definition, "scanner"), ContentScriptBuilder);

// @ts-expect-error: The real content constructor requires a boolean, not Relay's response mode.
new ContentScriptBuilder({allFrames: RelayAllFrames.All});
// @ts-expect-error: The real Relay constructor does not accept arbitrary modes.
new RelayBuilder({allFrames: "invalid"}, ContentScriptBuilder);
