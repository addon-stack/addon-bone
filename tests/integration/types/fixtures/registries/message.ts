import {onMessage, sendMessage, type MessageRegistry} from "adnbn/message";
import type {Equal, Expect} from "./assert";

declare module "adnbn/message" {
    interface MessageRegistry {
        "app:lookup": (data: {id: number}) => {title: string};
    }
}

type LookupData = Expect<Equal<Parameters<MessageRegistry["app:lookup"]>[0], {id: number}>>;

const result = sendMessage("app:lookup", {id: 1});
type LookupResult = Expect<Equal<typeof result, Promise<{title: string}>>>;

onMessage("app:lookup", data => {
    type HandlerData = Expect<Equal<typeof data, {id: number}>>;
    return {title: String(data.id)};
});

// @ts-expect-error: Public augmentation still constrains known message payloads.
sendMessage("app:lookup", {id: "invalid"});
// @ts-expect-error: Public augmentation still constrains known message responses.
onMessage("app:lookup", () => ({title: 1}));

// Preserve the open MessageDictionary contract for messages without a declared signature.
sendMessage("unregistered", {value: true});
