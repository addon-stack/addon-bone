# Changelog

## 🚀 Release Addon Bone v0.14.0 (2026-09-22)

### 💥 Breaking Changes

* The sandbox Builder now takes the view builder class as
its second constructor argument and no longer has a view() method,
adnbn/entry/sandbox no longer exports TransportBuilder, and the
adnbn/entry/transport subpath is removed.

* The offscreen Builder now takes the view builder class
as its second constructor argument and no longer has a view() method.

* A string returned by a Vanilla view render is shown as
text; return an Element or use a UI framework to render markup.

* The adnbn/entry/view subpath is removed together with
isViewDefinition() and isValidViewDefinitionRenderValue().

* adnbn/entry/command no longer exports
isValidCommandDefinition(), isValidCommandExecuteFunction() and
isValidCommandName().

* adnbn/entry/background no longer exports
isValidBackgroundDefinition() and isValidBackgroundMainHandler().

* Projects whose commands share a name, explicitly or
through their file names, now fail to build. Give each command a distinct
"name" option or file name.

* top-level newtab, bookmarks and history files and
directories in app or shared sources are entrypoints now. Page
entrypoints named newtab, bookmarks or history receive a numbered HTML
filename such as history1.html; their aliases do not change.


### ✨ Features

* **entrypoint:** add a shared permissions options contract ([7366e6a](https://github.com/addon-stack/addon-bone/commit/7366e6ad586b9a42ab8f05d7f9ce22f6fdf492f0))

  Describe install-time and optional API and host permissions once as
  PermissionsOptions with a matching schema module that a parser merges
  only when its entrypoint opts in. Apply it to the background family,
  which already declared these fields, without changing its behavior,
  and export the contract publicly.

  Document that schemas shared by unrelated parsers are mixin modules
  rather than members of AbstractParser or intermediate parser classes.

* **entrypoint:** declare permissions in popup, sidebar and options ([90c51b0](https://github.com/addon-stack/addon-bone/commit/90c51b0321ddea864af422aa6889d64e2ce7ce6b))

  Let popup, sidebar and options entrypoints declare the permissions
  their code needs. Whatever reaches the build contributes: every built
  popup or sidebar when several are allowed, because any of them can be
  switched to at runtime, and the single winning file otherwise. A
  sidebar that is unavailable for the target requests nothing.

  Collect the permissions in a view finder layer that only adopting
  entrypoints extend, next to the CSP layer, and expose one getter per
  kind typed with the manifest permission types. Plugins pass these
  values to the manifest builder explicitly; the override plugin follows
  the same shape and the standalone collecting helper is removed.

  Cover the adoption in each parser, the selection and caching on real
  directories, and real builds across Chrome and Firefox in MV2 and MV3.

* **entry:** render text and DOM elements the same way in every adapter ([e80fe23](https://github.com/addon-stack/addon-bone/commit/e80fe2344764e00d1f4cbacd669b8ec10e926e20))

  Share one render-value contract between the view and content adapters in
  src/entry/core/render.ts: a non-empty string or a number is inserted as
  text and never parsed as HTML, a DOM element is appended as is, and a
  React element still goes through React. The React adapters now render
  text and DOM elements instead of silently dropping them, the Vanilla view
  adapter stops parsing strings with innerHTML, and elements from another
  realm such as an iframe document are recognized by node type. Cover the
  shared contract in render.test.ts and the adapters through their
  builders, and document the rule in the content README.

* **offscreen:** render offscreen views with the injected view builder ([012df13](https://github.com/addon-stack/addon-bone/commit/012df1349be2eb037f8bfd64efb6fb144c113f73))

  Resolve offscreen exports in the runtime through resolveDefinition() over
  the shared transport merge, and let the offscreen Builder compose its
  transport with a view builder passed by the generated module, as Relay
  does with its content builder. Offscreen definitions adopt the new
  ViewRenderDefinition mixin, so render and container work with the adapter
  selected by the file extension, while init and main still receive only
  the offscreen options. The generated module becomes a single
  offscreen(resolveDefinition(module, name), ViewBuilder) call. Cover the
  startup and the layer composition in index.test.ts, and check the
  template and the adapter-free offscreen bundle graph in virtual.test.ts.

* **override:** add newtab, bookmarks and history entrypoints ([ebf8143](https://github.com/addon-stack/addon-bone/commit/ebf81433722804176594b7addd0ee54cf8f1a1e2))

  Discover, parse and build the pages that replace the browser new tab,
  bookmarks and history through chrome_url_overrides. Each page is a
  singleton view: app files replace shared ones instead of merging, and
  only the highest-precedence candidate is built.

  Select the override per build in one plugin: skip pages the target
  browser does not support and fail when more than one remains, because
  Chromium refuses to load an extension that overrides several pages.
  Write the selected page as a single manifest override that replaces
  raw chrome_url_overrides.

  Cover parsing, discovery, manifest generation, the selection policy and
  real Chrome rendering with unit, build and browser integration tests,
  and document the fixtures.

* **override:** declare permissions in override entrypoints ([05a0a51](https://github.com/addon-stack/addon-bone/commit/05a0a51bc25da9172cd83ac07fcb73420c470a74))

  Let the new tab, bookmarks and history pages declare the permissions
  their code needs. The manifest receives them only from the page that
  reaches the build: a candidate that lost the selection or a page the
  target browser does not support contributes nothing.

  Expose the parsed options of the selected views from the view finder
  and collect permissions from them with a pure helper, so other view
  entrypoints can adopt the contract the same way.

  Cover the schema adoption, winner-only selection, the plugin policy and
  real builds across browsers, where a skipped History page no longer
  requests the browsing history permission.

* **sandbox:** render sandbox views with the injected view builder ([8d27fe1](https://github.com/addon-stack/addon-bone/commit/8d27fe17e93069edb4b98e7e8b592b9a4ef6bb25))

  Resolve sandbox exports in the runtime through resolveDefinition() over
  the shared transport merge, and let the sandbox Builder compose its
  transport with the view builder passed by the generated module, as
  offscreen does. Sandbox definitions adopt ViewRenderDefinition, so render
  and container use the adapter selected by the file extension, while init
  and main receive only the sandbox options; adnbn/entry/sandbox exports
  its startup function instead of TransportBuilder. With no template left
  on the transport guards, remove the adnbn/entry/transport subpath, make
  the options-object check private to mergeDefinition, and drop the Relay
  and offscreen types from the transport resolvers. Cover the startup and
  the layer composition in index.test.ts, and check the template and the
  adapter-free sandbox bundle graph in virtual.test.ts.

* **view:** organize view types by adapter and export the render contract ([2479b76](https://github.com/addon-stack/addon-bone/commit/2479b768dbe9ed0d4d4a2cbf48471ea9c4bf44e0))

  Split @typing/view into common options and containers, per-adapter render
  values, the combined render contract, and the definitions, the same way
  the content types are organized. The Vanilla adapter owns DOM, text and
  empty values, the React adapter owns React nodes and components, and
  render.ts combines them, so a new adapter only adds its own file. Export
  the render contract types from adnbn next to ViewDefinition and
  ViewOptions. A Promise is no longer accepted as a render value, matching
  the runtime, which never rendered one; handlers can still await data.
  Cover the public types through source and package APIs in
  view.integration.test.ts and list the check in the integration README.



### 🐛 Bug Fixed

* **command:** reject duplicate command names ([4bc0e88](https://github.com/addon-stack/addon-bone/commit/4bc0e8883bb5e6de3e4cbbe005ac1af3dafc0b13))

  Fail the build when two commands resolve to the same name instead of
  renaming the later one with a numeric suffix. A command name is its
  identity in the manifest and in the browser's shortcut settings, so the
  silent rename broke the runtime subscription and could move a user's
  custom shortcut to another command. Report a dedicated error for a second
  action command, and derive file-based names through NameGenerator.derive()
  without claiming them. Cover explicit, merged app/shared and action
  collisions with real fixtures in CommandFinder.test.ts, and derive() in
  NameGenerator.test.ts.

* **entry:** render every React node the React adapters accept ([bc65b50](https://github.com/addon-stack/addon-bone/commit/bc65b50c4c170b00a69ea53e92c78a3e6d504c6f))

  The React view and content adapters accepted arrays, portals and bigints
  in their render types, since both use React's own ReactNode, but passed
  only React elements to React and silently rendered nothing for the rest;
  a default-exported portal was even merged as an options object. Recognize
  every React node through isReactRenderValue() in src/entry/core/react.ts,
  which only the React adapters import, and hand it to the React root,
  while text, numbers and DOM elements keep the shared render path; an
  iterable needs a callable iterator, so options objects stay options.
  Cover recognition, default exports and rendering of arrays, fragments,
  portals and bigints for both adapters, extend the type fixtures, and
  describe the contract in the view and content READMEs, noting that a
  bigint renders only with React 19.

* **view:** pass only HTML options to the tags plugin ([b7338de](https://github.com/addon-stack/addon-bone/commit/b7338ded770150d3bba233622c92bbd2158afb1e))

  Select the tags plugin options from the HTML options schema instead of
  excluding a few known keys, so view, build and manifest options such as
  icon, apply, mode, debug or manifestVersion no longer reach it and a
  view without HTML options adds no tags plugin at all.

  Move the HTML options schema out of ViewParser into a parser schema
  module shared by the parser and the view, and cover the selection with
  real popup fixtures.



### 🛠️ Refactoring

* **background:** resolve background definitions in the runtime entry ([17c9f95](https://github.com/addon-stack/addon-bone/commit/17c9f95c5e8c50794bdf60c165ea685e48121c16))

  Move default-export interpretation out of the generated background module
  into resolveDefinition() in the background resolvers: default options
  override named exports, a default function becomes main, and any other
  default value is ignored. The generated module becomes a single
  background(resolveDefinition(module)) call, and adnbn/entry/background now
  exports only the startup function and resolveDefinition(). Cover the merge
  rules in the background resolver test and check the template in
  virtual.test.ts alongside the other thin templates.

* **cli:** declare generated entrypoint modules with one wildcard ([a3cfaee](https://github.com/addon-stack/addon-bone/commit/a3cfaee1e340d8d4978c2c890e969cdbb78a13c9))

  Replace the eight virtual:*-entrypoint declarations with a single
  wildcard declaration: every generated module passes the entrypoint
  namespace to its runtime resolveDefinition(), which accepts any object,
  so the per-entrypoint export lists no longer describe anything the
  templates use. Keep the content and view builder declarations, whose
  startup and Builder types the templates still rely on. Remove the relay
  fixture assertions that pinned the old declaration to
  RelayUnresolvedDefinition; the fixture still type-checks the relay
  template against the real builders.

* **command:** resolve command definitions in the runtime entry ([954382a](https://github.com/addon-stack/addon-bone/commit/954382adb3423b8ba811c418bbfc39de80418856))

  Move default-export interpretation out of the generated command module
  into resolveDefinition() in the command resolvers: default options
  override named exports, a default function becomes execute, and the build
  always supplies the name, as for Relay and Service. The generated module
  becomes a single command(resolveDefinition(module, name)) call, and
  adnbn/entry/command now exports only the startup function and
  resolveDefinition(). Cover the merge and naming rules in the command
  resolver test and check the template in virtual.test.ts alongside the
  other thin templates.

* **entry:** import resolvers from their owning files ([2fc5eb9](https://github.com/addon-stack/addon-bone/commit/2fc5eb991448648729ca29cf1d61386d68736131))

  Remove the resolvers/index.ts barrels from the background, command,
  transport and content entrypoint runtimes and import each resolver from
  the file that owns it, as most callers already did. List the exports of
  adnbn/entry/transport explicitly, so mergeDefinition() stays internal and
  only the transport guards used by the offscreen and sandbox templates
  remain public. The behavior is unchanged and the existing suites cover the
  moved imports. Record both rules in the internal imports section of
  AGENTS.md.

* **transport:** share definition resolution across transport entrypoints ([70c305c](https://github.com/addon-stack/addon-bone/commit/70c305c307789a845ec936d476e2af432fb6f145))

  Move the Relay export merging into mergeDefinition() in the transport
  resolvers, so every transport entrypoint interprets a default options
  object or init function the same way and takes its name from the build.
  Relay and Service expose typed resolveDefinition() wrappers, and the
  generated Service module becomes a single service(resolveDefinition(...))
  call. Replace the generic transport template and its ":entry" placeholder,
  ts-ignore stripping and "adnbn/entry/:entry" declaration with a dedicated
  service template. Cover the shared merge rules in the transport resolver
  test, keep Relay's init-versus-render rule in its own test, and check the
  Service template in virtual.test.ts alongside Content and Relay.

* **view:** resolve and mount views in one adapter-driven builder ([73effdc](https://github.com/addon-stack/addon-bone/commit/73effdc34912e6a90198341d9bf8c9d118b2a434))

  Replace the view guards with mergeDefinition() and give the Vanilla and
  React adapters their own resolveDefinition(), so the generated view module
  becomes a single view(resolveDefinition(module)) call and only the React
  adapter knows React elements. Merge the view core builder and the
  duplicated adapter lifecycles into one abstract Builder that owns the
  title and the container, while adapters only resolve the render and mount
  its value; a Vanilla render of 0 is now rendered instead of skipped.
  Rename virtual:view-framework to virtual:view-builder for view, offscreen
  and sandbox. Cover definition merging, adapter recognition and both
  builders through their public build/destroy behavior, and check the
  template and the React-free Vanilla bundle graph in virtual.test.ts.




### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 30

## 🚀 Release Addon Bone v0.13.0 (2026-09-17)

### 💥 Breaking Changes

* default watch observes child-list mutations only and ignores
changes inside managed UI. Use a custom strategy to observe attributes or text.

* custom ContentScriptContext implementations must provide owns(target).

* Styles follow the entry's isolation by default. Use ?unisolated
to deliver CSS to the host document instead of opting into isolation with ?isolation.


### ⚡️ Performance Improvements

* **content:** coalesce watch cycles and filter UI mutations ([07f3a9e](https://github.com/addon-stack/addon-bone/commit/07f3a9e007acd2d73e50e3c994458108b0f35acf))

  Batch mutations in fixed windows and merge discovery requests into one cycle.
  Ignore updates inside managed UI and avoid redundant marker writes.
  Share completion and error handling without accumulating pending watch callbacks.
  Release cycle resources on destroy and remove await-lock and debounce.
  Document watch configuration, context ownership, and unresolved prepare promises.



### ✨ Features

* **content:** track managed containers through context ownership ([4dbb344](https://github.com/addon-stack/addon-bone/commit/4dbb344e0fbb946bb8654c9dba33737ec0bbf754))

  Register each mount independently and query managed UI through context.owns().
  Release registrations and renderer resources even when cleanup fails.
  Cover reentrant unmounts, reused containers, Shadow DOM, and the public contract.

* **styles:** route CSS by entry isolation and split document styles ([8b87b3b](https://github.com/addon-stack/addon-bone/commit/8b87b3b867a1b6b3a4adf36b142abf097a311dd8))

  Keep one JavaScript layer per execution world and choose stylesheet delivery
  per entry. Extract document CSS only from chunks used by isolated consumers,
  including shared lazy chunks, and refresh entry options during watch rebuilds.

  Cover shared components, initial and lazy CSS order, manifest/WAR, filename
  templates, asset inventories, watch transitions, and Chrome/Firefox delivery.
  Document the shared physical lazy-chunk ordering constraint.



### 🐛 Bug Fixed

* **bundler:** normalize asset maps and initial CSS filenames ([4fb40e4](https://github.com/addon-stack/addon-bone/commit/4fb40e478f8ce05858e8500290355b01bbeea1cd))

  Deduplicate emitted asset inventories after content hash substitution while
  preserving dependency order. Use the initial CSS filename template for shared
  initial chunks and keep runtime templates beside the asset-map plugin.

* **content:** wait for isolated styles before rendering ([e6cf5ea](https://github.com/addon-stack/addon-bone/commit/e6cf5eab1cca8ee870b3acf8bcb44ef632a5c636))

  Gate Shadow DOM and blank iframe rendering on stylesheet readiness while keeping
  mount and unmount synchronous. Preserve retry order, cancellation and mount events.

  Separate node composition stages, initialize main before markers, and centralize
  resolver checks. Cover lifecycle behavior with unit, type and browser tests.

* **locale:** preserve literal dollars in native translations ([f42b98a](https://github.com/addon-stack/addon-bone/commit/f42b98ae84f92b57267793c60a242b2ff1745c1a))




### 🧪 Tests

* **styles:** wait for the requested watch compilation ([1108f0e](https://github.com/addon-stack/addon-bone/commit/1108f0ecce8a3be62a1efe16b6f2c0b3812ec48b))

  Record CSS delivery selections per compilation and ignore stale watch results.
  Exercise an input change before the watch callback to reproduce the race without
  fixed delays or changes to production style routing.



### 🛠️ Refactoring

* **content:** simplify adapter render and definition layout ([a3ffabf](https://github.com/addon-stack/addon-bone/commit/a3ffabf765f62d4eda77404872d6e6e6d2546a4c))





### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 9

## 🚀 Release Addon Bone v0.12.0 (2026-09-15)

### 💥 Breaking Changes

* Remove ContentScriptFrameOptions and isolation.width /
isolation.height. Set iframe dimensions and styles through boundary;
iframes receive no framework width, height, border or display defaults.
ContentScriptProps now includes a required boundary property, and content
and Relay definitions carry an isolation type parameter. When specifying
data generics explicitly for an isolated entrypoint, specify its mode too.

* Render handlers are synchronous; asynchronous work and render
decisions belong in prepare. React render functions are components invoked by React.
ContentScriptProps now includes data, container, and target; container factories
receive ContentScriptContainerProps before those DOM elements exist.
ContentScriptWatchStrategy update callbacks may be asynchronous. Literal render:
true tracks anchors without UI, while prepare returning false skips UI creation.
Consumers checking published declarations require TypeScript 5.6.3 or newer.

* separate content adapters and simplify relay startup


### ✨ Features

* configure content isolation boundaries and render targets ([822cca3](https://github.com/addon-stack/addon-bone/commit/822cca363bb787dceee052a91955ba564f8a421c))

  Expose typed boundaries in content and Relay render props. Accept a tag,
  DOM properties or a synchronous factory for isolated render targets, and
  run boundary setup with an optional cleanup function for subscriptions.

  Share setup policy through IsolationSetup while the nodes retain DOM,
  style and cleanup ownership. Preserve synchronous mounting and protect
  cleanup, remounts and iframe document recovery from reentrant callbacks.

  Cover the contract with unit, declaration and browser integration tests,
  and document the current API and lifecycle.

* prepare content data before synchronous rendering ([57f3018](https://github.com/addon-stack/addon-bone/commit/57f3018219eb343c0a9bf050f1f9efad4767c849))

  Prepare data per anchor before creating UI and pass the prepared data, container,
  and render target to Content and Relay renderers. Keep mount and unmount
  synchronous, invalidate stale preparation, and retain watching after anchor errors.

  Cover lifecycle behavior, React portals, headless Relay, and published declarations.



### 📝 Documentation

* define code layout conventions ([55c6518](https://github.com/addon-stack/addon-bone/commit/55c65184a055dfbe0f68f21d601bdf67680e4dd0))




### 🤖 CI

* split test jobs and streamline git hooks ([d837609](https://github.com/addon-stack/addon-bone/commit/d837609b28cd6bcaf25047249cf6c02bc40a5497))




### 🧪 Tests

* parallelize suites and harden test infrastructure ([5076ccc](https://github.com/addon-stack/addon-bone/commit/5076ccc23da714842d098ee7e372b2e8d6ec1c47))


* wait for locale service worker initialization ([dcc5741](https://github.com/addon-stack/addon-bone/commit/dcc57418356ce3e1cc6c535b2ceef4d2ad2e4663))




### 🛠️ Refactoring

* centralize runtime access and organize bundler modules ([0e6698c](https://github.com/addon-stack/addon-bone/commit/0e6698cf72e114d983462e95b7cc245e28eaba39))

  Read entrypoint assets and isolated styles through the generated
  #adnbn/runtime facade. Keep Rspack runtime access in build code and preserve
  per-entrypoint asset-map selection and isolated CSS delivery.

  Separate asset collection, filename handling, compilation state and layer
  classification. Keep isolated-style helpers inside their owning plugin.

* organize content types by adapter ([a4396a0](https://github.com/addon-stack/addon-bone/commit/a4396a0d3dce1661e0cd9d86c22cdad3b1ff1d64))


* separate content adapters and simplify relay startup ([4a2a8a5](https://github.com/addon-stack/addon-bone/commit/4a2a8a5986d8dea0e5b044706925fc3f9d2d9c7e))

  Move shared content lifecycle and resolvers to their owners.
  Expose watch strategies through adnbn/content and keep framework
  normalization in the selected adapter.

  Move Relay normalization and content construction into runtime.
  Replace the old builder contract and update virtual modules,
  declarations, tests, and documentation.




### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 10

## 🚀 Release Addon Bone v0.11.0 (2026-09-13)

### 💥 Breaking Changes

* Runtime view titles, command descriptions, and titles
applied by changePopup/changeSidebar are now passed through unchanged.
Call resolve explicitly when translating locale markers is required.
Build-time localization of manifest fields is unchanged.

* Remove React LocaleProvider, LocaleProviderProps and
LocaleContract. Use useLocale or useNativeLocale, and apply DOM attributes
explicitly with useLocaleAttributes.

Rename provider languages()/languageNames() to langs()/langNames().
React langs now contains language codes; display names are in langNames.
useLocale().change() now returns Promise<Language>.

React adapters require React 18 or 19. React peers are now optional.


### ✨ Features

* **content:** add shadow DOM support ([1721c92](https://github.com/addon-stack/addon-bone/commit/1721c92f252347ad94bbc69e0d25adbd44e91919))


* **content:** consolidate isolation options and support closed roots ([68972af](https://github.com/addon-stack/addon-bone/commit/68972af26618e94452194322f0a9b5cca4158e56))

  Normalize shorthand and object isolation options for content scripts and Relay.
  Keep Shadow mode, iframe navigation, and dimensions under the isolation contract.

  Move static value resolution and default-export analysis into file readers.
  Validate normalized options with explicit Zod schemas while preserving enum
  injection and runtime boundaries.

  Update lifecycle, browser, watch, and parser tests alongside isolation documentation
  and repository conventions.

* **content:** unify shadow and iframe isolation ([e40b617](https://github.com/addon-stack/addon-bone/commit/e40b617219f18f91ef65e89113932a967b1f276a))

  Support isolation modes and frame page/src navigation for content scripts
  and Relay. Route opt-in isolation CSS separately from document styles,
  retain lazy loading, and expose resources without background dependencies.

  Render into ShadowRoot or iframe targets, recover blank iframe documents
  after host moves, and release stale CSS waits before teardown. Register
  fonts through CSS and remove the branch's experimental shadow/fonts API.

  Separate shared validation, feature policy, bundler integration and runtime
  nodes. Cover parser contracts, access rules, watch transitions, asset names,
  CSS errors/retries and browser behavior with unit and integration fixtures.

* **entrypoint:** expose asset maps and support content chunk loading ([d4730b2](https://github.com/addon-stack/addon-bone/commit/d4730b2f5e7f031ab0fc9602619a3bd3aef76e4a))

  Add per-entry asset metadata and a background-only full asset map.
  Respect output filename templates and isolate content chunk graphs by world.
  Normalize MV2 content scripts to ISOLATED with a build warning.

  Add Chrome and Firefox integration coverage and reorganize fixtures.
  Document project naming conventions, including class test filenames.

* **locale:** generate a shared virtual catalogue ([74b5c26](https://github.com/addon-stack/addon-bone/commit/74b5c2645b3de0a9aad7bfd8e96d5890b0881b30))

  Generate native locale JSON and virtual/locale from cached, validated
  messages. Add a reusable module generation plugin with watch updates and
  share the catalogue when used twice or when it reaches 100 KB, while
  keeping background self-contained.

  Cover catalogue equivalence, module isolation, watch updates, chunk
  boundaries and browser delivery with integration fixtures.

  Known limitation: Chrome deduplicates a shared content script path across
  MAIN and ISOLATED worlds. The mixed-world browser test still fails; this
  commit records the agreed first stage without changing script delivery.

* **locale:** replace the React provider with locale hooks ([f9d4436](https://github.com/addon-stack/addon-bone/commit/f9d4436391b4928ed0f5e51f9e5310a3115baa4d))

  Share dynamic state through ObservableLocale and expose native and dynamic
  React adapters with typed JSX substitutions and explicit DOM attributes.

* **locale:** support custom storage drivers ([b711e70](https://github.com/addon-stack/addon-bone/commit/b711e70c81d9feeb6b9a40c2aefed9ef878727f9))


* **locale:** use bundled translations in DynamicLocale ([17e2ef4](https://github.com/addon-stack/addon-bone/commit/17e2ef47c5344883ed594d912a7ee52b97d54a35))




### 🐛 Bug Fixed

* **build:** correct watch updates and virtual module imports ([f5701c6](https://github.com/addon-stack/addon-bone/commit/f5701c614deb98a4b3dd27ab07c932d58d8c4a02))

  Normalize watched entry paths, retain runtime-only JavaScript chunks in
  asset validation, and share chunk filename resolution below plugin owners.
  Resolve the virtual entrypoint source alias to its emitted ESM path during
  bundling instead of encoding output extensions in TypeScript imports.

* **build:** exclude tests from distribution ([04cbd6f](https://github.com/addon-stack/addon-bone/commit/04cbd6f918bc302ad51084a98db3c7cf7a00c5e3))


* **bundler:** embed entrypoint asset maps only for consumers ([5185bbb](https://github.com/addon-stack/addon-bone/commit/5185bbb7cc6538fd3200ee3ca5309649d730ec27))


* **bundler:** stabilize generated modules and watch updates ([921466f](https://github.com/addon-stack/addon-bone/commit/921466fd2dead6e2b860a3ef9f53909025b90373))


* **locale:** refresh generated translations reliably in watch mode ([5160519](https://github.com/addon-stack/addon-bone/commit/5160519f37ffe02e48ef7a7bf8da4ef69b10f744))


* **locale:** use build language when browser i18n is unavailable ([a1479ca](https://github.com/addon-stack/addon-bone/commit/a1479cac991ea6533a137938c9931098cb6fb23e))


* **types:** include tests in the editor project ([3b60f5e](https://github.com/addon-stack/addon-bone/commit/3b60f5eb5333476c79ebc338d029cb727ffa633d))




### 📝 Documentation

* document isolation behavior and architecture conventions ([f4fe39e](https://github.com/addon-stack/addon-bone/commit/f4fe39e69ce7e1ab5edd7c17ea317e5cebdc49ad))

  Document isolation modes, CSS routing, font delivery, iframe recovery and
  browser validation fixtures. Record responsibility boundaries, shared
  contract ownership and source import conventions in AGENTS.md.

  Leave CHANGELOG.md generation to the publication workflow.

* improve formatting and clarity in contribution and policy documents ([77f8b2b](https://github.com/addon-stack/addon-bone/commit/77f8b2bd99804641165b72b126dac4883eacdb69))




### 🤖 CI

* **release:** prepare protected main automation ([c839497](https://github.com/addon-stack/addon-bone/commit/c839497569d62fffe38cd2f553be049313c13194))




### 🧩 Other

* Improve code readability and consistency: ([9473e5e](https://github.com/addon-stack/addon-bone/commit/9473e5e765829d64cc748dbaee3f6edc239af497))

  - Add `holds` method to `entrypoint.ts` interface for file existence checks.
  - Update `.toSorted` usage in `AbstractFinder` for array sorting.
  - Apply consistent formatting with `prettier-ignore` in various files.
  - Minor refactor of `AbstractEntrypointFinder` regex patterns for clarity.

* organize package fields and frame type imports ([166b48d](https://github.com/addon-stack/addon-bone/commit/166b48df84bfa535f72318155d3b8ac6e2503f08))




### 🧪 Tests

* **browser:** allow stable browser versions ([3231ece](https://github.com/addon-stack/addon-bone/commit/3231ece02d0674457f241b619dc39af65b7b7e09))


* **browser:** close speculative connections during teardown ([e63c60b](https://github.com/addon-stack/addon-bone/commit/e63c60bf073e4f76363fc499bd4c8e0445285156))


* **entrypoint:** make virtual path assertion cross-platform ([f2af015](https://github.com/addon-stack/addon-bone/commit/f2af015e43eeab25acb0dda9638ef46aae09241a))


* fix Windows watch fixture updates ([e1ad886](https://github.com/addon-stack/addon-bone/commit/e1ad88641343340806a29538547b269520ec8e76))


* **locale:** fix Windows CI fixtures and output paths ([478e3cd](https://github.com/addon-stack/addon-bone/commit/478e3cd7c25dcf825d704eb7232c86f191839dc5))


* remove obsolete assertions and normalize fixture names ([d8d8202](https://github.com/addon-stack/addon-bone/commit/d8d82026514d971ad2f070756a1d9e48851202ec))

  Remove guards for discarded owner runtime implementations and replace
  Plan A fixture filenames and suite labels with neutral entrypoint names.
  Keep assertions for current placeholders and background independence.



### 🧹 Chores

* **test:** remove duplicate type checking ([d613c0f](https://github.com/addon-stack/addon-bone/commit/d613c0f1e427c32702a28bbe1cf8d96ab5aa3436))




### 🛠️ Refactoring

* **bundler:** organize plugins by directory ([6bdd6d2](https://github.com/addon-stack/addon-bone/commit/6bdd6d2f083b895e0bc00788420bc185e47a0591))


* **bundler:** remove unused runtime data plugin ([12719cf](https://github.com/addon-stack/addon-bone/commit/12719cf6eecf92f935aa410bd1f456fd4f99a0e9))


* **cli:** improve EntrypointMetaPlugin for better asset handling and modularity ([d4886cb](https://github.com/addon-stack/addon-bone/commit/d4886cb2569207cdb842639c21ac9b4111c2d1f4))


* deliver page and relay data through virtual modules ([36eb139](https://github.com/addon-stack/addon-bone/commit/36eb13914e0eb61ed9f8e87ac1a4b33c6b671f21))


* **locale:** centralize shared translation helpers ([20016ca](https://github.com/addon-stack/addon-bone/commit/20016ca72d6f41c24fabdc46f832a196f1ce941c))


* **locale:** make runtime translation explicit ([36032ff](https://github.com/addon-stack/addon-bone/commit/36032ff82915ff4382e1a544146888d4f71ad15d))

  Remove implicit locale resolution from view and command entrypoint
  wrappers and from changePopup/changeSidebar. Keep resolve available
  through the public locale entrypoint for explicit use.

* **locale:** move generated types to LocaleRegistry ([e7b49ad](https://github.com/addon-stack/addon-bone/commit/e7b49ad20e47fb9c8e049ac626cc80216478e2fb))


* **manifest:** normalize resource handling and validation ([5319ef7](https://github.com/addon-stack/addon-bone/commit/5319ef7cab04c5563a289b7eb75985d39ccd8302))

  Separate manifest utilities by responsibility and normalize merged WAR and
  host permission rules. Add compilation-scoped preparation and validation
  hooks with a generic resource access validator, and rebuild manifest state
  for each watch compilation.

* **relay:** enhance permission handling and improve type definitions ([4dd021a](https://github.com/addon-stack/addon-bone/commit/4dd021ac44d2dd288a66545ba6c4feaeff597e55))

  - Refactored permission handling logic for `RelayPermission` to improve clarity and maintainability.
  - Updated type definitions for `declarative` field to support `ContentScriptDeclarative` enum.
  - Improved code formatting and consistent conditional handling across relay components.
  - Added return types to private methods for better type inference.

* **runtime:** centralize page and relay metadata ([e3777f2](https://github.com/addon-stack/addon-bone/commit/e3777f23a1b9b5f66c87266ebb4c7e9a870dee71))

  Embed serialized metadata with RuntimeDataPlugin and keep property contracts
  and augmentable Page/Relay registries in the shared type layer. Preserve
  public exports and generated declarations, refresh Relay data in watch,
  and substitute runtime template values once without reinterpreting data.

* unify entrypoint virtual data and shared contracts ([af251c5](https://github.com/addon-stack/addon-bone/commit/af251c5fbc1ac6c3c32f2741d10a16d2734dadbd))

  Deliver popup, sidebar, offscreen, sandbox and icon data through
  generated virtual modules with package fallbacks.

  Move augmentable registries and related contracts into src/types.
  Preserve public augmentation and generate popup/sidebar/icon registries.
  Order shared declarations and document empty contracts.

  Add build coverage for data delivery and tree shaking, plus source
  and package contract checks in tests/integration/types.




### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 38
- [Addon Stack](mailto:addonbonedev@gmail.com) — commits: 5

## 🚀 Release Addon Bone v0.10.0 (2026-08-28)


### ✨ Features

* **options:** add options page entrypoint ([74cb6f3](https://github.com/addon-stack/addon-bone/commit/74cb6f3814dfdc4917e03fa9f6528055d1b61245))

  Add shared View rendering for React and Vanilla with openInTab
  configuration and options_ui manifest generation.

  Rename AbstractOptionsFinder to AbstractParsedFinder and cover discovery,
  parsing, manifests, and browser rendering with tests.



### 🐛 Bug Fixed

* **release:** correct breaking commit parsing in release notes ([f6aa5b2](https://github.com/addon-stack/addon-bone/commit/f6aa5b239853561488262167f9db50785825e766))


* **release:** restore version-only GitHub release titles ([a790486](https://github.com/addon-stack/addon-bone/commit/a79048620e1d60d7e81324dfac4f0d6ffd0073fd))





### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 4

## 🚀 Release Addon Bone v0.9.0 (2026-08-28)

### 💥 Breaking Changes

* Secondary locales must define default plural keys. Direct LocaleProvider
implementations must add languageNames(). Generated types now augment LocaleNativeStructure.

* Relay calls use mutually exclusive frame/document targets.
Remote Relay types are exported from adnbn, with entrypoint internals under
adnbn/entry/relay. DeepAsyncProxy is replaced by RpcAsyncProxy.


### ✨ Features

* **locale:** feat(locale)!: complete catalogs and unify locale contracts ([df3b468](https://github.com/addon-stack/addon-bone/commit/df3b4682381ca645232f08e29160bba14d6d75be))

  Fill ordinary gaps from the assembled app default and validate plural keys before JSON generation.
  Expose native language names through providers and React, and generate registry-only declarations.
  Preserve known empty native messages and return nonzero CLI status on initialization failures.

* **relay:** feat(relay)!: support multi-frame calls and unified results ([b9888a8](https://github.com/addon-stack/addon-bone/commit/b9888a859e2f1c6aa3336e6ea8481cf2b4d15ca4))

  Add frame and document targets, Any/All modes, and per-target outcomes.
  Centralize permission handling and align public exports and generated types.
  Protect raw virtual templates from alias rewrites and expand regression tests.
  Document the Relay runtime contract and user-gesture constraints.



### 🐛 Bug Fixed

* **release:** use Addon Bone in GitHub release headings ([8ca422c](https://github.com/addon-stack/addon-bone/commit/8ca422ca44c195ee3f30bc0e230b7feb7c5180ca))

  Brand release titles and changelog headings with the framework name.
  Verify pre-1.0 breaking bumps and generated release notes.



### 🧪 Tests

* **relay:** normalize declaration paths across platforms ([a644da8](https://github.com/addon-stack/addon-bone/commit/a644da84b972b241b199833541c2d5c430da35cc))

  Normalize virtual declaration and resolved API paths before comparison.
  Exercise POSIX and Windows separators for source and package contracts.




### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 5

## 🚀 Release `adnbn` v0.8.0 (2026-08-18)


### ✨ Features

* **finder:** implement file precedence for layered locale and plugin resolution ([2d147d0](https://github.com/addon-stack/addon-bone/commit/2d147d043b7faa1779868be9f133f81e0e1177ce))

  - Add file precedence system to prioritize layers and browser-specific files.
  - Enhance locale merging logic with multi-layered and browser-specific resolution.
  - Introduce duplicate layer detection and error handling for ambiguous files.
  - Add layered locale and file precedence fixture tests for rigorous validation.



### 🤖 CI

* **release:** simplify and refine release rules and version bump logic ([331124c](https://github.com/addon-stack/addon-bone/commit/331124c05b15b9d79e559c2cc83ca1b65044e6d0))

  - Extract `whatBump` and `hasBreakingChange` for cleaner code organization.
  - Remove redundant `releaseRules` and inline `whatBump` implementation.
  - Consolidate breaking change detection logic for better maintainability.




### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 3

## 🚀 Release `adnbn` v0.7.1 (2026-07-27)


### 🐛 Bug Fixed

* **service:** allow offscreen documents to call background services ([e85fc6f](https://github.com/addon-stack/addon-bone/commit/e85fc6f43e8fbd7ac2492c875518d6e12e594bff))




### 📝 Documentation

* **readme:** refresh package overview ([2d7d8e7](https://github.com/addon-stack/addon-bone/commit/2d7d8e7e1c96191832c5440bf9d0c4316f826364))




### 🤖 CI

* add non-browser test workflow and refine matrix setup ([d40273c](https://github.com/addon-stack/addon-bone/commit/d40273cf94ca52785d3a41d0eb65fbcec58682ee))




### 🧪 Tests

* enhance timeout and error handling in offscreen service integration test ([7b0c3ec](https://github.com/addon-stack/addon-bone/commit/7b0c3ecc13ec19d143c72e471a3c3b59559113c5))


* improve timeout handling in CdpClient integration tests ([a584525](https://github.com/addon-stack/addon-bone/commit/a5845252c087da8afb9c39207c52854e311dec02))





### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 6

## 🚀 Release `adnbn` v0.7.0 (2026-05-25)


### ✨ Features

* **csp:** add CSP builder layer for extension entrypoints ([66a7e77](https://github.com/addon-stack/addon-bone/commit/66a7e775d3096a03f9f71edd02bd6d9e3ca466f8))

  - Add typed CSP configs for view entrypoints and sandbox pages
  - Merge per-entrypoint CSP options into MV2 and MV3 manifest output
  - Wire page, popup, sidebar, and offscreen CSP into extension-pages CSP
  - Keep sandbox CSP generation browser-aware
  - Cover CSP builders and manifest merge behavior with tests

* **manifest:** add sandbox and content security policy support for MV2 and MV3 ([2fb3e62](https://github.com/addon-stack/addon-bone/commit/2fb3e624f525ff54067c427205460ac4eda4cd3d))

  - Add `addSandbox`, `appendSandboxes`, and `setSandboxContentSecurityPolicy` methods
  - Implement builders for sandbox pages and content security policies in MV2 and MV3
  - Update tests for manifest sandbox functionality

* **sandbox:** introduce sandbox message system and host/iframe communication support ([7350888](https://github.com/addon-stack/addon-bone/commit/73508888a817844bb724877347d2ed501d9d4353))

  - Add `SandboxMessage`, `SandboxHost`, `SandboxInner`, and `SandboxMemory` classes.
  - Implement in-memory and iframe-based sandbox communication.
  - Add `ReadyFrame` utility for iframe readiness handling.
  - Extend tests to cover sandbox message system, frame initialization, and transport.



### 🐛 Bug Fixed

* **page:** add sandbox entrypoint support to PageFinder ([8de9e0a](https://github.com/addon-stack/addon-bone/commit/8de9e0af9696fe85a70212029a72635fadb357c2))


* **style:** add support for merging Sass and CSS with PostCSS and improve style handling ([1db73c9](https://github.com/addon-stack/addon-bone/commit/1db73c9446ecfe36e6c675216c3fb63341c02c8a))




### 🧪 Tests

* add unit tests for locale validation and name generator refactor ([b7695da](https://github.com/addon-stack/addon-bone/commit/b7695da4480e70b65c71d7216141d77563596e00))




### 🧹 Chores

* enhance type handling and add multiline union alias support in tests ([2e385a1](https://github.com/addon-stack/addon-bone/commit/2e385a1eaa6a94206656bf4e928e11af03473d6d))




### 🛠️ Refactoring

* **csp:** add sandbox CSP support and integrate with view finders ([06f2a3b](https://github.com/addon-stack/addon-bone/commit/06f2a3b34aa2e0e7be310e96b540e46cc7b4c88a))

  - Implement `SandboxViewFinder` extending `ViewCspFinder` to handle sandbox CSPs.
  - Add `sandbox.ts` fixture to define sandbox CSP configurations.
  - Update `Sandbox` to fetch CSPs using view-based methods.
  - Adjust manifest to include sandbox CSPs via updated view logic.
  - Add tests to validate sandbox CSP collection and integration.

* **message:** extract error handling into dedicated utility module ([2ea2fb0](https://github.com/addon-stack/addon-bone/commit/2ea2fb05677e770dfaadecf4aaf5b9561d6fed37))

  - Move `serializeError` and `restoreError` from `MessageManager` to `error.ts`
  - Replace inline error handling with shared utility functions across the message layer
  - Add comprehensive tests for error serialization and restoration logic

* **transport:** refactor transport interfaces and add sandbox registry support ([26f8099](https://github.com/addon-stack/addon-bone/commit/26f80999f185dee7e6394678a4cc3f9bde2e6091))

  - Split `TransportMessage` into `TransportSender` and `TransportReceiver`
  - Add `TransportMessage` implementation combining sender and receiver
  - Introduce `TransportDeclarationLayer.Sandbox` and `sandbox.d.ts` handling
  - Implement `TransportBuilder` for sandbox transport initialization
  - Add `destroy` method and cleanup mechanism to `RegisterTransport`




### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 11

## 🚀 Release `adnbn` v0.6.1 (2026-05-19)


### 🐛 Bug Fixed

* **transport:** improve error handling and result structure across transports ([2dc9aca](https://github.com/addon-stack/addon-bone/commit/2dc9aca34cfca78c17ef89451db1f9f8c2e895e6))

  - Add structured error serialization and restoration in MessageManager
  - Add support for envelope-like response structures in messages
  - Improve test coverage for various error scenarios in message handlers
  - Refactor transport registries with stricter type constraints
  - Update transport APIs to use scoped registry names and target types




### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 2

## 🚀 Release `adnbn` v0.6.0 (2026-05-11)


### ⚡️ Performance Improvements

* **build:** enable separate TypeScript declaration file generation ([7864487](https://github.com/addon-stack/addon-bone/commit/7864487f8fde6d37282047fc19dde2f5d964e825))




### ✨ Features

* **config:** add `shared` option for configurable shared source layer ([0ff5c34](https://github.com/addon-stack/addon-bone/commit/0ff5c346623e5a1a402b08fcae9dc5c02b7abedf))

  - Introduced `shared` option to configure shared directories as `false`, `true`,
   or a custom string.
  - Added tests to validate behavior for all `shared` option cases.
  - Updated type definitions to document the new `shared` configuration.

* **offscreen:** add lifecycle tests and improve iframe readiness handling ([db39da2](https://github.com/addon-stack/addon-bone/commit/db39da29e7d66d41fa422e48c3c2a258d698089a))

  - Added tests to validate iframe lifecycle, including creation, readiness, and removal.
  - Improved offscreen iframe readiness by waiting for a specific "ready" message.
  - Updated timeout handling for iframe readiness and added error messaging.

* **workspace:** add workspace mode for single and multi app structure ([8469d92](https://github.com/addon-stack/addon-bone/commit/8469d92c52bf55abc27cdec74bfe47206370393b))

  - add Workspace enum with single and multi modes
  - replace shared config option with workspace
  - keep sharedDir as a public configurable directory
  - normalize sharedDir to "." for single workspace
  - use configured sharedDir for multi workspace
  - update config resolver tests for workspace behavior



### 🐛 Bug Fixed

* **command:** simplify error message for invalid command key options ([c02a4dd](https://github.com/addon-stack/addon-bone/commit/c02a4ddb06d8639817b44ed2924cc1f82539ae83))


* **locale:** validate locale contract and tighten substitutions ([d3b05a6](https://github.com/addon-stack/addon-bone/commit/d3b05a67d77a29987139f7ee984760269eaefd0a))

  - resolve config.lang to a concrete Language before plugins run
  - validate locale structure against the default language contract
  - allow missing keys in secondary locales and warn about extra keys
  - generate locale keys and types from the default language only
  - trim runtime substitution placeholders to match generated types
  - make substitution arguments strict in TypeScript
  - fix manifest plain name, shortName and description handling
  - replace locale helpers with t, choice, key and resolve
  - preserve empty-string values in custom and dynamic locales
  - add locale validator, manifest, runtime and type-level tests

* **parsers:** correct regex patterns for object type formatting in `SignatureBuilder` ([6acda7d](https://github.com/addon-stack/addon-bone/commit/6acda7daf7d26ab39643667991af5d5d61d2ffbb))


* **parsers:** exclude `this` parameter from signature generation ([1d5f3cd](https://github.com/addon-stack/addon-bone/commit/1d5f3cd99127f09b62a9cac9595c9f988ffa8c74))

  - Updated `SignatureBuilder` to filter out `this` parameters in method signatures.
  - Adjusted tests in `ExpressionFile` to reflect changes in method return type.
  - Refined type usage and formatting in service definition for consistency.

* **tests:** improve path normalization and add Windows-specific diagnostics test ([354f428](https://github.com/addon-stack/addon-bone/commit/354f42836f94a1d41a499d6703321052318281d4))


* **tests:** normalize paths in entrypoint and locale tests ([de0b494](https://github.com/addon-stack/addon-bone/commit/de0b49429ed201a7b2ad69359e4f57c4fd0f356f))




### 🧹 Chores

* **deps:** bump lodash to v4.18.1 ([209be45](https://github.com/addon-stack/addon-bone/commit/209be45ad7c1681d05fb18c466049320829f4513))


* **deps:** update `ts-node` to v10.9.2 and clean up outdated dependencies ([409bf0b](https://github.com/addon-stack/addon-bone/commit/409bf0bee800e62a4c23b657e1822a918f8f951a))


* **docs:** remove projects skills ([31c2407](https://github.com/addon-stack/addon-bone/commit/31c2407e9c3f9484ca46e5a75cfb13af4f02a35f))


* **manifest:** remove redundant comment in URL match validation logic ([2e095da](https://github.com/addon-stack/addon-bone/commit/2e095daadc23b6f1cea17dca6c3b8c6ba8ac365c))


* simplify documentation for `EntrypointOptions` by removing redundant notes ([7869818](https://github.com/addon-stack/addon-bone/commit/78698181e38d46bf5c7600b0a1cd7ec660e4517f))


* **tsconfig:** reformat include list and update exclude patterns ([1afe794](https://github.com/addon-stack/addon-bone/commit/1afe794eefe30def474bbb0afe6861c938889f86))




### 🛠️ Refactoring

* **command:** enhance shortcut key validation and add tests for CommandParser ([c0e9464](https://github.com/addon-stack/addon-bone/commit/c0e9464ff21fa428de2343b758e4184651ec6d89))

  - Refined shortcut key validation, supporting media and platform-specific keys.
  - Added stricter global shortcut constraints and error messaging improvements.
  - Introduced comprehensive tests to ensure robust validation logic.

* **finder:** improve sorting logic and enhance priority handling ([9c1dbcf](https://github.com/addon-stack/addon-bone/commit/9c1dbcf71ab99b70718694511c67814a800892bf))


* **finder:** restructure file collection logic to support grouped and root entrypoints ([4ae0c7b](https://github.com/addon-stack/addon-bone/commit/4ae0c7b0df98256557d2c765485427734ea0af1a))


* **Manifest:** add raw method to manifestBuilder, add plugin and manifest option to config ([491dc83](https://github.com/addon-stack/addon-bone/commit/491dc8357b5a2b2f07bdac21dd602796b19b1be6))


* **Manifest:** improve permissions and host permissions logic, improve raw manifest merging ([ddc543b](https://github.com/addon-stack/addon-bone/commit/ddc543bc8d96a0d5bed45942c45679d696f61dbf))


* **manifest:** streamline `combined*` methods for readability and maintainability ([83db7c1](https://github.com/addon-stack/addon-bone/commit/83db7c1979da8f91230c7be3381ad812edcf9db4))





### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 24
- [Rostyslav Nihrutsa](https://github.com/RostyslavNihrutsa) (@RostyslavNihrutsa) — commits: 2

## 🚀 Release `adnbn` v0.5.7 (2026-02-04)


### ⚡️ Performance Improvements

* **config:** extend `commonChunks` to support dynamic chunk naming functionality ([2bbd640](https://github.com/addon-stack/addon-bone/commit/2bbd6405a0a5be6346f0530b6476f8592892e058))


* **optimization:** enhance chunk splitting and export handling in plugin config ([24ee48b](https://github.com/addon-stack/addon-bone/commit/24ee48bf921618632cee118bd7e862b63b4b25ee))


* **plugins:** enhance chunk splitting logic with entry filtering and path resolution ([e376378](https://github.com/addon-stack/addon-bone/commit/e376378113e30224392ead24ccf40333b11df73b))




### 🐛 Bug Fixed

* **config:** simplify dotenv config by removing redundant environment variable settings ([35caec2](https://github.com/addon-stack/addon-bone/commit/35caec281830d1b090b5f8ecd2171a0a84f40d85))




### 🧹 Chores

* **deps:** update dependencies in `package-lock.json` to latest compatible versions ([1678839](https://github.com/addon-stack/addon-bone/commit/16788399f1f36c7bfa398aec7482e0ebb6ae055c))





### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 5
- [Addon Stack](https://github.com/addon-stack) (@addon-stack) — commits: 1

## 🚀 Release `adnbn` v0.5.6 (2026-01-28)


### 🐛 Bug Fixed

* extend permissions with BookmarksInfo and improve test coverage ([054a40c](https://github.com/addon-stack/addon-bone/commit/054a40cce7754ba4dd739a7b7ddc74c01d4390f6))





### 🙌 Contributors

- [Addon Stack](https://github.com/addon-stack) (@addon-stack) — commits: 1
- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 1

## 🚀 Release `adnbn` v0.5.5 (2026-01-28)


### ⚡️ Performance Improvements

* add support for data collection permissions in gecko-specific settings ([e69fa41](https://github.com/addon-stack/addon-bone/commit/e69fa41328b6db48f8300f998da4d9b04eeae689))




### 🤖 CI

* **release:** simplify npm config and pin npm version in workflow ([67c3a17](https://github.com/addon-stack/addon-bone/commit/67c3a17907b3418cae3808b6d0ef67f37df78ff5))





### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 2
- [Addon Stack](https://github.com/addon-stack) (@addon-stack) — commits: 1

## 🚀 Release `adnbn` v0.5.4 (2026-01-17)


### 🐛 Bug Fixed

* update repository url format for compatibility with npm standards ([d751d2b](https://github.com/addon-stack/addon-bone/commit/d751d2becc002c5df9ded4260958ecf5db22165d))




### 🤖 CI

* **release:** enhance npm publish config and enable provenance in workflow ([9bbae3e](https://github.com/addon-stack/addon-bone/commit/9bbae3e1d655afb7637b407d281be63d4686e8fa))


* **release:** skip npm checks and clean release workflow config ([f35fd05](https://github.com/addon-stack/addon-bone/commit/f35fd056f01ce6230d5ad1991186600701c7933f))


* **release:** update npm settings and workflow for registry and provenance handling ([8552c31](https://github.com/addon-stack/addon-bone/commit/8552c31ae8f3fc968dbb77d7218beb095b112ac5))


* **release:** update release config for npm provenance and registry handling ([20377c4](https://github.com/addon-stack/addon-bone/commit/20377c43307a6ab81b77a70c93a68ea8bd393a4e))


* remove unused auth tokens from release workflow ([1fbf28b](https://github.com/addon-stack/addon-bone/commit/1fbf28bcda15b39dfd96211a3001c2d93efb0b79))




### 🧹 Chores

* **deps:** update dependencies in package-lock.json for latest versions ([b3a1177](https://github.com/addon-stack/addon-bone/commit/b3a117755b3b6f2bda3fd5cf4d4851195800a030))


* **deps:** update package-lock to upgrade and align dependencies ([1954eb8](https://github.com/addon-stack/addon-bone/commit/1954eb87509fa6cc2b66ab4ab7cfeb8bb81cc16e))


* **types:** adjust interface formatting for consistency and readability ([7f08239](https://github.com/addon-stack/addon-bone/commit/7f08239e4efd1cf8cb4c33088026ebb501f911d2))




### 🛠️ Refactoring

* **locale:** add container prop for dynamic lang/dir attribute handling ([c409172](https://github.com/addon-stack/addon-bone/commit/c409172955a8080ddada7c030b50d086adeaa41f))


* **locale:** improve locale handling and language resolution logic ([71d0b1c](https://github.com/addon-stack/addon-bone/commit/71d0b1cdeb2e134f71555d3d25a8300136ee561b))

  - Renamed `normalizeLocale` to `resolveLanguage` for clarity.
  - Enhanced language detection logic with better fallback handling.
  - Added comprehensive comments to explain Chrome i18n locale detection limitations.
  - Improved error messages and logging for unsupported or failed locale resolutions.
  - Updated related imports and adjusted code for the `resolveLanguage` function.

* **Locale:** streamline language detection and normalization logic ([f420c38](https://github.com/addon-stack/addon-bone/commit/f420c38a32261a0eb07cc29278de3ce044a5ff17))





### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 11
- [Addon Stack](https://github.com/addon-stack) (@addon-stack) — commits: 8
- [Rostyslav Nihrutsa](https://github.com/RostyslavNihrutsa) (@RostyslavNihrutsa) — commits: 1

## 🚀 Release `adnbn` v0.5.3 (2025-11-25)


### 🐛 Bug Fixed

* **config:** format `whatBump` logic for readability and maintainability ([90dc51d](https://github.com/addon-stack/addon-bone/commit/90dc51d4686770af9697e5693e1aacee577d2bb0))


* enhance release rules and bump logic for semantic versioning ([d99f6fc](https://github.com/addon-stack/addon-bone/commit/d99f6fcbd0f42d3e181c06ab10bb185a089ff7dd))




### 🧹 Chores

* **deps:** update `c12` and `@rsdoctor/rspack-plugin` to latest versions ([addae18](https://github.com/addon-stack/addon-bone/commit/addae18643c037d307f393f5a78348e3ba67b7be))


* **deps:** update package-lock to upgrade dependencies ([76e0b1e](https://github.com/addon-stack/addon-bone/commit/76e0b1e26442633899b8911f8f493dcf344b945b))




### 🛠️ Refactoring

* **config:** improve output, optimization, and style plugin configurations ([f0a07d5](https://github.com/addon-stack/addon-bone/commit/f0a07d5008569bf3b097f15d2c117f5842ae97c6))


* **content:** improve content manager handling and add comprehensive utils tests ([4cead1a](https://github.com/addon-stack/addon-bone/commit/4cead1adb3890ee672bc08097de0b9a165f39769))





### 🙌 Contributors

- [Addon Stack](https://github.com/addon-stack) (@addon-stack) — commits: 8

## 🚀 Release `adnbn` v0.5.2 (2025-11-10)


### 🐛 Bug Fixed

* **cli:** set default DOTENV_LOG level to 'error' instead of 'none' ([2ff78be](https://github.com/addon-stack/addon-bone/commit/2ff78bef7dd4919c459adaefc0d607727943e816))




### 🧹 Chores

* **plugins:** standardize plugin export names for consistency ([fc2cb55](https://github.com/addon-stack/addon-bone/commit/fc2cb554787523aec786ffc83700db20a2e6cb94))




### 🛠️ Refactoring

* **dotenv:** remove encryption/decryption logic and simplify env handling ([9af389f](https://github.com/addon-stack/addon-bone/commit/9af389fbba53457e32c32ee23b27cbb4cd92c834))

  - Deleted `crypt.ts` module and associated tests.
  - Removed references to encryption/decryption in dotenv utils and plugins.
  - Simplified `resolveEnvOptions` to eliminate `crypt` flag handling.
  - Updated tests to reflect the removal of encryption-related logic.
  - Renamed `ReservedEnvKeys` to `EnvReservedKeys` for consistency.

* **meta:** remove `Email` plugin and implement `SpecificSettings` plugin ([82db540](https://github.com/addon-stack/addon-bone/commit/82db540f1a5def467e6685ece71a0b0f22cd7d53))

  - Deleted `Email` metadata plugin and its associated tests.
  - Added `SpecificSettings` plugin to handle browser-specific configurations.
  - Updated manifest builder to support `browser_specific_settings` via `SpecificSettings`.
  - Enhanced typing schemas to include `BrowserSpecific` definitions.
  - Refactored related code and tests to incorporate new plugin and remove redundant logic.

## 🚀 Release `adnbn` v0.5.1 (2025-10-28)


### 🐛 Bug Fixed

* **Message:** remove unsupported `documentId` option in sendTabMessage for Firefox ([07a2599](https://github.com/addon-stack/addon-bone/commit/07a259996d5f55a4ca3d3c3de11683e630d98b56))




### 🧪 Tests

* **Message:** add `documentId` support in sendTabMessage with Firefox handling ([7d41a73](https://github.com/addon-stack/addon-bone/commit/7d41a73a0185322c4c523eaa7899d0be7a0c65cf))




### 🧹 Chores

* **deps:** remove unused `@types/validator` dependency from package.json ([c5745a5](https://github.com/addon-stack/addon-bone/commit/c5745a57be108941ff0c6e890a5f951a722f82da))

## 🚀 Release `adnbn` v0.5.0 (2025-10-22)


### ⚡️ Performance Improvements

* **content:** add processing lock mechanism with `await-lock` ([24a9395](https://github.com/addon-stack/addon-bone/commit/24a93951f621481803a003a0f3a95e4ba3844302))




### ✨ Features

* **content:** add `WeakMarker` implementation and integrate with content resolvers ([a35abd6](https://github.com/addon-stack/addon-bone/commit/a35abd697c233403282d161a820d8824340ff64a))

  - Introduced `WeakMarker` for managing weakly referenced element markers.
  - Updated `core.ts` to register `ContentScriptMarker` resolvers.
  - Enhanced `ContentParser` schema with `marker` validation support.
  - Integrated `WeakMarker` into `Builder` with necessary error handling.

* **content:** introduce marker-based anchor handling and cleanup resolvers ([bd7b897](https://github.com/addon-stack/addon-bone/commit/bd7b897cb131dddcf1197d3892d404aa7891eab7))

  - Added `ContentScriptMarkerContract` for marker management.
  - Replaced `contentScriptAnchorAttribute` with marker attribute logic.
  - Refactored `Node` and introduced `MarkerNode` wrapping for marker operations.
  - Abstracted marker logic into `AbstractMarker` and `AttributeMarker`.
  - Updated related definitions and resolved configurations for marker integration.

* **entrypoint:** add definition shorthand support and improve tests ([e29e3f9](https://github.com/addon-stack/addon-bone/commit/e29e3f9075c87a9ecccd94f9303db359166309a4))




### 🐛 Bug Fixed

* fix email mapping and update git shortlog command to use mailmap ([bdbd0b2](https://github.com/addon-stack/addon-bone/commit/bdbd0b28349b9e96c38beff0b367df2e16ef822e))




### 🧪 Tests

* **content:** add comprehensive test coverage for markers ([04572f4](https://github.com/addon-stack/addon-bone/commit/04572f4feb436577b3ee1a120fb1e83277971d19))

  - Added new unit tests for `WeakMarker`, `AttributeMarker`,
    and unified `Marker` tests.
  - Improved test specificity and coverage across different marker implementations.
  - Removed redundant tests and refactored existing ones for clarity.

* **content:** add unit tests for `AttributeMarker` functionality ([1977f8c](https://github.com/addon-stack/addon-bone/commit/1977f8c86d29fb4cc5a1a056dcb7dfeb8201505a))




### 🧹 Chores

* **deps:** update package-lock to upgrade dependencies ([92556a6](https://github.com/addon-stack/addon-bone/commit/92556a6c02df253000c93d6660b654179dd27463))


* **deps:** update package-lock to upgrade dependencies ([ee784b8](https://github.com/addon-stack/addon-bone/commit/ee784b802e411c8578aa90ae158c12fe7d19dcd9))




### 🛠️ Refactoring

* **content:** improve marker querying and unify unmarked handling ([d40c7e1](https://github.com/addon-stack/addon-bone/commit/d40c7e1fc1f6fcb4b019ba81f86fcd96c2c8754a))


* **content:** remove redundant marker type validation in `Builder` ([073e69c](https://github.com/addon-stack/addon-bone/commit/073e69c21f658172302b6cf5c3b73e3a50271853))


* **entrypoint:** enhance shorthand property type resolution and refactor methods ([d6316e9](https://github.com/addon-stack/addon-bone/commit/d6316e9f5fca308a12038c74a359ffef0371b612))

  - Implemented `resolveTypeFromShorthand` for cleaner and reusable logic.
  - Improved `SourceFile` handling for shorthand property assignments.
  - Moved background tests to a standalone file for better test structure.

* **icon:** update `getIcons` return type and migrate to `Map` usage ([b981cf5](https://github.com/addon-stack/addon-bone/commit/b981cf521b4b5f8b36639e0dba612a96489ad815))

## 🚀 Release `adnbn` v0.4.2 (2025-10-13)


### ⚡️ Performance Improvements

* **icon:** add support for updating the sidebar icon ([5080b50](https://github.com/addon-stack/addon-bone/commit/5080b50527053b9ee82b2468a6e807d168c7003f))


* **icon:** add support for updating the sidebar icon ([c5d8852](https://github.com/addon-stack/addon-bone/commit/c5d8852b25146d89443499e6f512881fb7d82fcc))




### 🐛 Bug Fixed

* **config:** add debug-based dotenv logging configuration ([cce9cc5](https://github.com/addon-stack/addon-bone/commit/cce9cc5238050d441138744a3b944f668a3aaa6d))




### 🧹 Chores

* **deps:** update dependencies and add overrides for package improvements ([84c783a](https://github.com/addon-stack/addon-bone/commit/84c783aa51b169b2d821429c397b2afd1eba611d))

  - Upgraded dependencies: `@types/node`, `caniuse-lite`, `glob`, `immutable`.
  - Updated `source-map` version and replaced duplicates with a single entry.
  - Added `overrides` section to ensure compatibility for `html-rspack-tags-plugin` and `tsup`.

* update dependencies and improve configuration ([08b551a](https://github.com/addon-stack/addon-bone/commit/08b551a935312f35f3e7d9f8f7a1d09874b8ac21))


* update dependencies in `package-lock.json` to newer versions ([81db4e1](https://github.com/addon-stack/addon-bone/commit/81db4e1ee86db6d1a341f43f847d7ef9e5d6ce40))




### 🛠️ Refactoring

* add changeSidebarIcon declaration ([8fa6ed2](https://github.com/addon-stack/addon-bone/commit/8fa6ed299f77a6e3f687ffaf8edfa26353a2c092))





### 🙌 Contributors

- [Addon Stack](mailto:addonbonedev@gmail.com) — commits: 8

## 🚀 Release `adnbn` v0.4.1 (2025-10-10)


### 🐛 Bug Fixed

* include `scripts` in published files ([7ed4238](https://github.com/addon-stack/addon-bone/commit/7ed4238c0536e46f691c7018254d820888791286))





### 🙌 Contributors

- [Addon Stack](https://github.com/addon-stack) (@addon-stack) — commits: 1
- [Addon Stack](mailto:addonbonedev@gmail.com) — commits: 1

## 🚀 Release `adnbn` v0.4.0 (2025-10-10)


### ⚡️ Performance Improvements

* configure husky and commitlint for commit message validation ([d40b8cb](https://github.com/addon-stack/addon-bone/commit/d40b8cbed2e47aad3f080412fe4e941eb1efd686))

  - Added Husky hooks for `pre-commit`, `pre-push`, and `commit-msg`.
  - Integrated Commitlint with conventional commit configuration.
  - Updated `.gitattributes` for consistent line endings.
  - Added necessary scripts and dependencies in `package.json`.



### ✨ Features

* add Firefox locale validator and integrate it into locale handling ([fc97578](https://github.com/addon-stack/addon-bone/commit/fc9757899fb4342d7cb1ae16ae9a4bd72e71449b))


* add Opera-specific locale validator and update locale builder logic ([f682b4c](https://github.com/addon-stack/addon-bone/commit/f682b4c5d96e11e1319cfc2e9b967bc072ee076a))




### 🤖 CI

* add release-it configuration for automated versioning and changelog generation ([cdafd06](https://github.com/addon-stack/addon-bone/commit/cdafd06934b1d4c15a4e7496fd175c05cf3f70a2))

  - Introduced `.release-it.cjs` configuration file with custom plugins and GitHub integration.
  - Added `@release-it/conventional-changelog` and `release-it` dependencies.
  - Updated `package.json` and `package-lock.json` with new devDependencies.

* update workflow naming and correct npm script usage ([f1b06ae](https://github.com/addon-stack/addon-bone/commit/f1b06aeaf878038313a5d8bcb429048ae8a90b58))




### 🧹 Chores

* add release and release:preview commands to package.json ([360f546](https://github.com/addon-stack/addon-bone/commit/360f546d46ad545619755be710753654f6ed3c05))


* **ci:** update job name order in workflow configuration ([8409775](https://github.com/addon-stack/addon-bone/commit/8409775904d622d7cc7a50673f9d950138a8e910))


* **dependencies:** update package-lock.json with additional dependencies and version updates ([d0fe719](https://github.com/addon-stack/addon-bone/commit/d0fe71971be2fc20b0e9b3a675dad9c4a6fb064b))


* **deps:** update core-js-compat to v3.46.0 in package-lock.json ([6aedcda](https://github.com/addon-stack/addon-bone/commit/6aedcda774c4354868c5092d7daa0673c8f3faef))


* **deps:** update dependencies ([feea325](https://github.com/addon-stack/addon-bone/commit/feea325741efe26d72b6dd5aa91ec3f09e1997bd))


* **prettier:** update `.prettierignore` to exclude GitHub workflows directory ([8d8d303](https://github.com/addon-stack/addon-bone/commit/8d8d303bbac97537e618aaa3469fe38d729e2294))


* sync lockfile with package.json ([86e5ba1](https://github.com/addon-stack/addon-bone/commit/86e5ba1b4bd5ea093f156c19035802e648b2d26e))


* **typings:** add module declarations and type definitions for `adnbn` modules ([70aeb5c](https://github.com/addon-stack/addon-bone/commit/70aeb5c9ed9868dbd81448eab55dc517de675d10))


* update author details and add .mailmap file ([2306a3d](https://github.com/addon-stack/addon-bone/commit/2306a3de91f2615150b526548ba826bcbbcb0dcb))

  - Updated `author` and `contributors` fields in `package.json`.
  - Added `.mailmap` file to map consistent author metadata.

* update dependencies and adjust package-lock.json ([8b0ded1](https://github.com/addon-stack/addon-bone/commit/8b0ded179eced4d7d29124aadc674e09ac3eb82b))

  - Added `esbuild` and optional dependency `@esbuild/darwin-arm64`.
  - Upgraded dependencies including `@jsonjoy.com/json-pack`, `get-tsconfig`, and `string-width`.
  - Downgraded `wrap-ansi` to maintain compatibility.
  - Consolidated redundant `meow` and `ansi-styles` version references.

* update release-it configuration and repository URL ([4ce1612](https://github.com/addon-stack/addon-bone/commit/4ce1612ae6218dad0600f969204aeba49668ba42))




### 🛠️ Refactoring

* adjust plugins, CI matrix, and Node.js version support ([b387cc1](https://github.com/addon-stack/addon-bone/commit/b387cc18c51ee719f6a86eb28c104a82d41af2fc))

  - Refactored `fixVirtualIndexImportPlugin` to use a function for consistency.
  - Updated CI workflows to modify Node.js version matrix and defaults.
  - Bumped Node.js version to 22 in `release.yml` for Node.js setup.
  - Simplified error message handling in `check-node-version.js`.

* restructure vendor declarations and improve alias handling for typescript plugin ([df85fcd](https://github.com/addon-stack/addon-bone/commit/df85fcd9d14b401827640b7882c2e19a00e24fc5))

  - Moved vendor declaration files to `vendor` folder for better organization.
  - Introduced `vendorAliases` for alias mapping in `TypescriptConfig`.
  - Added `paths` helper method to streamline `paths` generation in TypeScript configuration.
  - Updated `include` and `paths` in `TsConfigJson` for cleaner configuration.

* update dependencies and migrate to `@addon-core` packages ([bfab53e](https://github.com/addon-stack/addon-bone/commit/bfab53ec0a9551a59471b498c3f0e3b4cdcaa0dc))

  - Replaced `@adnbn/*` packages with `@addon-core/*` equivalents.
  - Added `@addon-core/storage` dependency.
  - Updated package version to `0.3.0`.
  - Removed unused `storage` exports and test scripts from `package.json`.



### Tests

* migrate fixtures to `tests/fixtures` directory for better structure ([9304995](https://github.com/addon-stack/addon-bone/commit/930499587b9fe7cf9cdd890f716eb040eb0f26cd))





### 🙌 Contributors

- [Addon Stack](https://github.com/addon-stack) (@addon-stack) — commits: 21
- [Addon Stack](mailto:addonbonedev@gmail.com) — commits: 4
- [Rostyslav Nihrutsa](mailto:rostyslav.nihrutsa@gmail.com) — commits: 2
