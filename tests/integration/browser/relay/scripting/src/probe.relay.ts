import {defineRelay, RelayMethod} from "adnbn";

export default defineRelay({
    name: "probe",
    method: RelayMethod.Scripting,
    declarative: true,
    matches: ["http://127.0.0.1/*"],
    excludeMatches: ["http://127.0.0.1/empty.html"],
    init: () => ({
        ready: () => true,
        empty: (): void => {},
        nullable: (): null => null,
        fail: (): never => {
            throw new TypeError("Remote failure");
        },
        reject: (): Promise<never> => Promise.reject(new RangeError("Async failure")),
        report: (result: object): void => {
            document.body.dataset.result = JSON.stringify(result);
        },
    }),
});
