---
name: offscreen
description: Project guidance for addon-bone offscreen transport work. Use when changing or reviewing ProxyOffscreen scheduling, OffscreenBridge Firefox iframe fallback, request-scoped $sender transport context, SignatureBuilder transport signatures, or related offscreen/service/relay tests in /Users/anjeytsibylskij/Documents/AddonStack/addon-bone.
---

# Addon Bone Offscreen Transport

## Core Map

Use the real checkout as source of truth. Start with these files:

- `src/offscreen/providers/ProxyOffscreen.ts` for Chrome MV3 offscreen lifecycle and Web Locks scheduling.
- `src/offscreen/OffscreenBridge.ts` and `src/entry/offscreen/Builder.ts` for Firefox iframe fallback readiness.
- `src/transport/RegisterTransport.ts` and `src/types/message.ts` for request-scoped `$sender`.
- `src/cli/entrypoint/file/parsers/SignatureBuilder.ts` for generated transport method signatures.
- `src/offscreen/providers/Offscreen.test.ts`, `src/offscreen/OffscreenBridge.test.ts`, `src/transport/RegisterTransport.test.ts`, and `src/relay/providers/Relay.test.ts` for behavior contracts.

## Offscreen Scheduling

Keep orchestration in `ProxyOffscreen`, not in `@addon-core/browser`. The browser package is utility-only: direct API access, simple helpers, and no locks or side effects.

Chrome MV3 offscreen scheduling uses two Web Locks:

- Gate lock: serializes lifecycle decisions so multiple contexts cannot race through `hasOffscreenPath()` and `createOffscreen()`.
- Active lock: shared while same-URL calls are executing, exclusive while switching URL/closing/creating offscreen.

Preserve the intended behavior:

- Same offscreen URL calls may run in parallel.
- Different offscreen URL calls must wait until active calls finish before closing/recreating the document.
- Release active locks in `finally` around message calls and lifecycle creation paths.
- `acquireLock()` intentionally keeps the Web Lock callback pending and exposes its resolver as a manual release function.
- Do not reintroduce singleton URL state in `ProxyOffscreen`; different proxy instances may legitimately target different offscreen URLs.

Content scripts cannot rely on `chrome.runtime.getContexts`; direct offscreen lifecycle checks from content script fail in Chrome. Treat content-script offscreen lifecycle as a separate design problem, not as a small bug in `ProxyOffscreen`.

## Firefox Bridge

Firefox uses background page plus iframe fallback, not native `chrome.offscreen`. `OffscreenBridge.createOffscreen()` must mean "the iframe offscreen transport is ready", not merely "the iframe loaded".

Preserve this handshake:

- `OffscreenBridge` creates or reuses the iframe.
- The offscreen entry builder sets `OffscreenGlobalAccess` early only to mark offscreen scope. Do not use it as readiness.
- After `transport.build()` and optional `view.build()`, the builder calls `ready()`.
- `ready()` posts `{ type: OffscreenBridgeReadyMessageType }` to `window.parent` only when running inside an iframe.
- `OffscreenBridge` resolves creation after receiving that `postMessage` from the exact iframe `contentWindow` and same `location.origin`.

Do not fall back to `iframe.onload` as the readiness signal. It races with listener registration and can produce "Receiving end does not exist" in Firefox.

`framesReady` is a `Map<string, Promise<void>>` for in-flight readiness promises by URL. It deduplicates concurrent `create()` calls for the same iframe URL and must be cleaned up in `finally` after success or failure. `data-ready="true"` is DOM state recovery for an existing ready iframe after the in-flight promise has been removed.

On bridge failure paths, reject with an `Error`, not `undefined`. `iframe.onerror` should remove the iframe and reject with a load error. Ready timeout should use `readyTimeout`, remove the iframe, and reject with a timeout error so the next attempt starts from a clean iframe.

## Sender Context

`$sender` is a framework-reserved runtime property for service/offscreen transport methods. It is request-scoped and exposed through a `Proxy` in `RegisterTransport.withSender()`.

Preserve these rules:

- Do not mutate the real registered instance with `$sender`.
- Do not add `_sender` aliases.
- Use `Reflect.get(target, property, receiver)` for normal property reads.
- Invoke methods with `property.apply(context, args)` so `this.$sender` works.
- Parallel calls on the same instance must each observe their own sender.

Developer-facing usage:

```ts
import type {MessageSenderAware} from "adnbn/message";

export default () => ({
    async ping(this: MessageSenderAware) {
        return this.$sender?.tab?.id;
    },
});
```

Generated transport types must not include the TypeScript `this` parameter. `SignatureBuilder.getMethodSignature()` filters parameters where `p.name.getText() === "this"`.

## Testing And Validation

Use focused tests first, then broader validation when touching shared transport behavior:

```bash
npm run typecheck
npm run test:offscreen -- --runInBand --detectOpenHandles
npm test -- src/transport/RegisterTransport.test.ts --runInBand --detectOpenHandles
npm run test:entrypoint -- --runInBand --detectOpenHandles
npm test -- --runInBand --detectOpenHandles
npm run build
npm run build --prefix addon
```

For manual addon checks, use `addon/src/shared/background.ts` and `addon/src/shared/popup.tsx` patterns. Background/popup sender identity usually appears through `sender.url` and `sender.origin`; `sender.tab.url` is not expected for extension pages.
