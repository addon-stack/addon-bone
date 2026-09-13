# Embedded page integration

Two content entries embed a typed extension page alias and an external HTTP page. The external
entry requests MAIN; MV2 normalizes it to ISOLATED. Known child messages prove the expected document
executed; iframe load alone is not treated as success. The separate site is the receiving document.

The runner also verifies that insufficient page WAR origin coverage fails an MV3 build. `contract.ts`
contains positive and negative public type checks, including generated page aliases.

```sh
npm run build
npx jest --testPathPatterns=frame-pages --runInBand
```
