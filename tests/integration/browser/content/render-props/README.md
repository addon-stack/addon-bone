# Prepared Content render props

Exercises the published package in Chrome MV3 and Firefox MV2. Preparation waits for a page-controlled
release, then reads a real asynchronous response from the background context. Before release there
must be no UI containers; Relay RPC must already be callable while Relay main is still pending.

The fixture checks per-anchor data, denied and removed anchors, literal headless rendering, Vanilla
DOM props, React portals in closed Shadow DOM and an iframe, preserved state on an unchanged target,
and fresh props after remount or actual iframe document navigation.

Custom targets exercise a tag string, a DOM-properties object, and a factory using prepared data.
The iframe factory creates its element in the child document and configures the frame through
`boundary`. Snapshots check the actual boundary, custom tag, and React portal destination. An intact
mount preserves the target; iframe document recovery calls the factory again. Headless Relay rejects
any attempt to call its target factory.

Boundary checks cover typed setup before rendering, cleanup on remount/unmount, and iframe document recovery without repeating setup. Setup and cleanup counters are exposed on each anchor.
