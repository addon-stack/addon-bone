import {renderRuntimeTemplate} from "./runtime-template";

test("inserts values literally without recursively replacing template-like content", () => {
    const literal = "$& $` $' __ADNBN_OTHER__";
    expect(
        renderRuntimeTemplate(" __ADNBN_VALUE__ __ADNBN_OTHER__ __ADNBN_VALUE__ ", {
            __ADNBN_VALUE__: literal,
            __ADNBN_OTHER__: "other",
        })
    ).toBe(`${literal} other ${literal}`);
});

test("reports unused values and missing substitutions in the original template", () => {
    expect(() => renderRuntimeTemplate("__ADNBN_VALUE__", {__ADNBN_OTHER__: "unused"})).toThrow(
        'Runtime template placeholder "__ADNBN_OTHER__" is unavailable'
    );
    expect(() => renderRuntimeTemplate("__ADNBN_VALUE__", {})).toThrow(
        'Runtime template placeholder "__ADNBN_VALUE__" was not replaced'
    );
});
