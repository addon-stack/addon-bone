# Relay type-checking follow-up — 2026-09-25

This follows the [migration benchmark](2026-09-25.md). Measurements use the same Apple M3 Max, 16 logical CPUs,
macOS arm64, Node 24.5.0 and TypeScript 5.9.3. Jest retains eight workers and `--no-sparkplug`.
All reported test runs passed. These are local measurements, not Linux/Windows or Node 22 CI results.

## Diagnosis and change

An independent compiler-host probe confirmed that narrowing `ContentScriptContainerTag` to `"div"` in memory reduces
checking of a minimal Relay constructor consumer from about 4.2 seconds to 1.08 seconds. The repository's container type
was not narrowed. The baseline trace placed 3.12 seconds in `checkExpression` for `new entry.Builder(...)`; CPU profiling
also identified type inference and relation checks. Instantiation counts alone do not explain elapsed time.

The expensive boundary accepted a full `RelayDefinition` only through `RelayUnresolvedDefinition`, a partial mapped type.
`Builder` and the Relay bootstrap function now try a full-definition overload first. This preserves the named definition
for inference; the existing partial-input signature remains last, including its parameter-reflection behavior.
`ContentScriptBuilderConstructor` names the constructor contract shared by these signatures.

Container tags, tag-specific attributes, callback data and isolation restrictions remain unchanged. TypeScript transpilation
with comments removed produces identical JavaScript for all three changed implementation/contract files. No JIT flags,
worker settings or runtime implementation were changed.

The declaration test retains source/package × POSIX/Windows coverage for registry augmentation, selectors and exports.
Constructors and bootstrap moved to `types/relay.integration.test.ts`, with source and package modes. It preserves the
original complete, prepared, unresolved and resolved-input calls and source virtual-entry checks. Additional checks cover
React adapters, inferred prepared data, specialized adapters, invalid data/isolation and invalid container options.

Failed overload resolution with fully inferred incompatible adapters can still be expensive: four negative calls took
about 4.4 seconds each in a diagnostic probe. Their rejection was verified. The permanent rejection checks supply explicit
type arguments; inference is checked separately by positive calls and an exact inferred Builder type assertion. This change
optimizes valid named definitions, not every possible error-reporting path.

## Minimal consumer comparison

The probe uses the same virtual consumer file, compiler options and installed dependencies in both states. Before each
baseline program, the compiler host reads only the three changed production files from `7c4e136e`; the fixed state reads
the working tree. It does not check out files or modify the repository. Both use source aliases and ordinary Node without
Jest or a JIT flag. Each state has one warm-up and three measured runs, alternating before/after in separate Node processes.

| Metric                       | Before        | After         |
| ---------------------------- | ------------- | ------------- |
| Median diagnostic/check time | 4.200 s       | 1.226 s       |
| Check-time range             | 4.054–4.285 s | 1.120–1.331 s |
| Type instantiations          | 519,633       | 408,563       |

Checking this complete source program is **3.43× faster**. Program construction is excluded from that figure and is recorded
separately in the raw results. The separate single-tag control is a diagnostic experiment, not a proposed API change.

## Test-suite comparison

Build + types ran sequentially with one warm-up and three measured runs. These commands reuse an existing package build
and include Jest JSON reporting, matching the earlier benchmark's group measurement. The new suite has one additional
file and two additional Jest cases; existing constructor scenarios were moved rather than discarded.

| Measurement                           | Earlier benchmark            | After this change |
| ------------------------------------- | ---------------------------- | ----------------- |
| Build + types median wall             | 54.48 s                      | 22.59 s           |
| Build + types range                   | 52.89–54.48 s                | 22.27–23.10 s     |
| Suites / tests                        | 36 / 283                     | 37 / 285          |
| RelayDeclaration file median          | 53.91 s                      | 3.88 s            |
| New Relay constructor file median     | Included in declaration file | 4.69 s            |
| Override build file median            | 22.33 s                      | 22.01 s           |
| Whole pre-push/check command, one run | 64.03 s                      | 42.11 s           |
| Whole npm test, one run               | 66.16 s                      | 52.32 s           |

Build + types is **2.41× faster**. The remaining longest file is the override build integration, with 33 CLI build scenarios.
Its timing is effectively unchanged; these measurements do not establish a type-checking bottleneck in View.
The two Relay files can now run concurrently, but the group remains bounded by the override file and available workers.

`check` passed **172 suites / 1961 tests**, framework typechecking and preparation/typechecking of 24 fixture applications.
The full run passed **203 suites / 2003 tests**, including Chrome and Firefox. The whole-command figures are single
observations, not medians or guarantees: pre-push/check improved about 1.52× and the full command about 1.26× in these runs.
The earlier pre-push command was renamed to `check` without changing its stages.

## Raw results and reproduction

The [raw results](2026-09-25-relay-types.json) contain all probe runs, the exact probe script, group warm-up and measured runs,
per-file timings, full-suite results and command exit codes. The embedded probe script pins the baseline source revision.
Restore it into a temporary file and run it from the repository root:

```sh
node -e "require('node:fs').writeFileSync('/tmp/relay-type-comparison.cjs', require('./tests/benchmarks/2026-09-25-relay-types.json').probe.script)"
node /tmp/relay-type-comparison.cjs before
node /tmp/relay-type-comparison.cjs after
node /tmp/relay-type-comparison.cjs single-tag
```

Set `TRACE_DIR` to an empty temporary directory to record the compiler trace for a probe. The source consumer exists only
in the compiler host. It instantiates `defineRelay({name: 'scanner', init: () => ({scan: (text: string) => text.length})})`
through `new entry.Builder(definition, ContentBuilder)` using the vanilla adapter.

For the suite measurements, build once, warm up the group once, then repeat it three times with unique report filenames:

```sh
npm run build
npm run test:run -- --selectProjects build types --json --outputFile=/tmp/relay-build-types.json
npm run check
npm test -- --json --outputFile=/tmp/relay-full.json
```

Measure whole commands with an external monotonic timer. Do not compare diagnostic-only probe time with Jest wall time,
or per-file sums with CPU time. The full/check commands each include their own single package build.
