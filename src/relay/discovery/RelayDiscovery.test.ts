import {getManifest} from "@addon-core/browser";
import {getBrowserTest} from "@tests/browser-harness/session";

import RelayDiscovery, {RelayDiscoveryError} from "./RelayDiscovery";

const manifest = {
    manifest_version: 3,
    name: "Relay test",
    version: "1.0.0",
} satisfies ReturnType<typeof getManifest>;

describe("RelayDiscovery", () => {
    const frames = () => getBrowserTest().harness.configurable.chrome.webNavigation.getAllFrames;

    beforeEach(() => {
        getBrowserTest().harness.runtime.setManifest({...manifest, permissions: []});
    });

    test("requires webNavigation for strict Messaging allFrames discovery", async () => {
        const discovery = new RelayDiscovery();

        await expect(discovery.discover(5)).rejects.toEqual(
            expect.objectContaining<Partial<RelayDiscoveryError>>({
                name: "RelayDiscoveryError",
                message: expect.stringContaining('requires the "webNavigation" permission'),
            })
        );
        expect(frames().calls).toHaveLength(0);
    });

    test("reports an unavailable manifest instead of silently degrading discovery", async () => {
        getBrowserTest().harness.runtime.getManifest.setImplementation(() => {
            throw new Error("runtime.getManifest is unavailable");
        });
        const discovery = new RelayDiscovery();

        await expect(discovery.discover(5)).rejects.toEqual(
            expect.objectContaining<Partial<RelayDiscoveryError>>({
                name: "RelayDiscoveryError",
                message: expect.stringContaining("could not verify"),
                cause: expect.objectContaining({message: "runtime.getManifest is unavailable"}),
            })
        );
        expect(frames().calls).toHaveLength(0);
    });

    test("returns deterministic unique targets through webNavigation", async () => {
        getBrowserTest().harness.runtime.setManifest({...manifest, permissions: ["webNavigation"]});
        const topFrame: chrome.webNavigation.GetAllFrameResultDetails = {
            frameId: 0,
            documentId: "document-0",
            documentLifecycle: "active",
            frameType: "outermost_frame",
            parentFrameId: -1,
            processId: 1,
            errorOccurred: false,
            url: "https://example.com/",
        };
        const childFrame: chrome.webNavigation.GetAllFrameResultDetails = {
            ...topFrame,
            frameId: 2,
            documentId: "document-2",
            frameType: "sub_frame",
            parentFrameId: 0,
            parentDocumentId: "document-0",
            url: "https://example.com/frame",
        };
        frames().setResult([childFrame, topFrame, childFrame]);
        const discovery = new RelayDiscovery();

        await expect(discovery.discover(5)).resolves.toEqual([
            {tabId: 5, frameId: 0, documentId: "document-0"},
            {tabId: 5, frameId: 2, documentId: "document-2"},
        ]);
        expect(frames().calls[0].args).toEqual([{tabId: 5}]);
    });

    test("reports webNavigation discovery failures", async () => {
        getBrowserTest().harness.runtime.setManifest({...manifest, permissions: ["webNavigation"]});
        frames().failNext(new Error("No tab with id 5"));
        const discovery = new RelayDiscovery();

        await expect(discovery.discover(5)).rejects.toEqual(
            expect.objectContaining<Partial<RelayDiscoveryError>>({
                name: "RelayDiscoveryError",
                message: expect.stringContaining("webNavigation.getAllFrames"),
                cause: expect.objectContaining({message: "No tab with id 5"}),
            })
        );
    });
});
