import {defineRelay, RelayMethod} from "adnbn";
import {options} from "./settings";

export default defineRelay({...options, method: RelayMethod.Messaging});
