import {RelayMethod} from "adnbn";
import RegisterRelay from "@relay/providers/RegisterRelay";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
type Scanner = {scan(text: string): number};

const registration = new RegisterRelay("scanner", RelayMethod.Scripting, () => ({scan: (text: string) => text.length}));

type RegisteredInstance = Expect<Equal<ReturnType<typeof registration.get>, Scanner>>;
