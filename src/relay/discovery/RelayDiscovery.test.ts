import {getAllFrames, getManifest} from "@addon-core/browser";

import RelayDiscovery, {RelayDiscoveryError} from "./RelayDiscovery";

const mockedGetAllFrames = getAllFrames as jest.MockedFunction<typeof getAllFrames>;
const mockedGetManifest = getManifest as jest.MockedFunction<typeof getManifest>;

const manifest = {
    manifest_version: 3,
    name: "Relay test",
    version: "1.0.0",
} satisfies ReturnType<typeof getManifest>;

describe("RelayDiscovery", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetAllFrames.mockReset();
        mockedGetManifest.mockReset();
        mockedGetManifest.mockReturnValue({...manifest, permissions: []});
    });

    test("requires webNavigation for strict Messaging allFrames discovery", async () => {
        const discovery = new RelayDiscovery();

        await expect(discovery.discover(5)).rejects.toEqual(
            expect.objectContaining<Partial<RelayDiscoveryError>>({
                name: "RelayDiscoveryError",
                message: expect.stringContaining('requires the "webNavigation" permission'),
            })
        );
        expect(mockedGetAllFrames).not.toHaveBeenCalled();
    });

    test("reports an unavailable manifest instead of silently degrading discovery", async () => {
        mockedGetManifest.mockImplementation(() => {
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
        expect(mockedGetAllFrames).not.toHaveBeenCalled();
    });

    test("returns deterministic unique targets through webNavigation", async () => {
        mockedGetManifest.mockReturnValue({...manifest, permissions: ["webNavigation"]});
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
        mockedGetAllFrames.mockResolvedValue([childFrame, topFrame, childFrame]);
        const discovery = new RelayDiscovery();

        await expect(discovery.discover(5)).resolves.toEqual([
            {tabId: 5, frameId: 0, documentId: "document-0"},
            {tabId: 5, frameId: 2, documentId: "document-2"},
        ]);
        expect(mockedGetAllFrames).toHaveBeenCalledWith(5);
    });

    test("reports webNavigation discovery failures", async () => {
        mockedGetManifest.mockReturnValue({...manifest, permissions: ["webNavigation"]});
        mockedGetAllFrames.mockRejectedValue(new Error("No tab with id 5"));
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
