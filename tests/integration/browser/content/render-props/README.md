# Prepared Content render props

Exercises the published package in Chrome MV3 and Firefox MV2. Preparation waits for a page-controlled
release, then reads a real asynchronous response from the background context. Before release there
must be no UI containers; Relay RPC must already be callable while Relay main is still pending.

The fixture checks per-anchor data, denied and removed anchors, literal headless rendering, Vanilla
DOM props, React portals in closed Shadow DOM and an iframe, preserved state on an unchanged target,
and fresh props after remount or actual iframe document navigation.
