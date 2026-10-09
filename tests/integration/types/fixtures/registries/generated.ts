import * as api from "adnbn";
import * as service from "adnbn/service";
import * as offscreen from "adnbn/offscreen";
import * as sandbox from "adnbn/sandbox";
import type {Equal, Expect} from "./assert";

type WorkerInstance = {run(input: string): number};
type DocumentInstance = {parse(input: string): boolean};
type FrameInstance = {render(input: string): Promise<string>};

type PopupNames = Expect<Equal<api.PopupAlias, "popup" | 'quoted"popup'>>;
type SidebarNames = Expect<Equal<api.SidebarAlias, "sidebar">>;
type IconNames = Expect<Equal<api.IconName, "brand">>;
type ServiceNames = Expect<Equal<service.ServiceName, "worker">>;
type OffscreenNames = Expect<Equal<offscreen.OffscreenName, "document">>;
type SandboxNames = Expect<Equal<sandbox.SandboxName, "frame">>;
type PopupMap = Expect<Equal<ReturnType<typeof api.getPopups>, api.PopupMap>>;
type SidebarMap = Expect<Equal<ReturnType<typeof api.getSidebars>, api.SidebarMap>>;
type IconsMap = Expect<Equal<ReturnType<typeof api.getIcons>, api.IconsMap>>;
type OffscreenMap = Expect<Equal<ReturnType<typeof api.getOffscreens>, api.OffscreenMap>>;
type SandboxMap = Expect<Equal<ReturnType<typeof api.getSandboxes>, api.SandboxMap>>;

api.changePopup("popup");
api.changePopup('quoted"popup', 1);
api.changeSidebar("sidebar", 1);
api.changeActionIcon("brand", 1);
api.changeSidebarIcon("brand");
api.changeActionIcon();
api.changeSidebarIcon();
api.getPopups().get("popup");
api.getSidebars().get("sidebar");
api.getIcons().get("brand");

api.defineConfig({action: {icon: "brand"}});
api.definePopup({icon: "brand", render: "Popup"});
api.defineSidebar({icon: "brand", render: "Sidebar"});

// @ts-expect-error: Action defaults use the generated icon group names.
api.defineConfig({action: {icon: "unknown"}});
// @ts-expect-error: Popup icons use the generated icon group names.
api.definePopup({icon: "unknown", render: "Popup"});
// @ts-expect-error: Sidebar icons use the generated icon group names.
api.defineSidebar({icon: "unknown", render: "Sidebar"});

const worker = api.getService("worker");
const document = api.getOffscreen("document");
const frame = api.getSandbox("frame");
const localWorker = service.getService("worker");
const localDocument = offscreen.getOffscreen("document");
const registeredWorker = new service.RegisterService("worker", () => localWorker).get();
const registeredDocument = new offscreen.RegisterOffscreen("document", () => localDocument).get();

const registeredFrame = new sandbox.RegisterSandbox(
    "frame",
    (): FrameInstance => ({
        render: async input => input,
    })
).get();

const workerResult = worker.run("input");
const documentResult = document.parse("input");
const frameResult = frame.render("input");
const localWorkerResult = localWorker.run("input");
const localDocumentResult = localDocument.parse("input");

type WorkerResult = Expect<Equal<typeof workerResult, Promise<number>>>;
type DocumentResult = Expect<Equal<typeof documentResult, Promise<boolean>>>;
type FrameResult = Expect<Equal<typeof frameResult, Promise<string>>>;
type LocalWorkerResult = Expect<Equal<typeof localWorkerResult, number>>;
type LocalDocumentResult = Expect<Equal<typeof localDocumentResult, boolean>>;
type WorkerProxy = Expect<Equal<typeof worker, service.ServiceProxyTarget<"worker">>>;
type DocumentProxy = Expect<Equal<typeof document, offscreen.OffscreenProxyTarget<"document">>>;
type FrameProxy = Expect<Equal<typeof frame, sandbox.SandboxProxyTarget<"frame">>>;
type WorkerTarget = Expect<Equal<typeof localWorker, service.ServiceTarget<"worker">>>;
type DocumentTarget = Expect<Equal<typeof localDocument, offscreen.OffscreenTarget<"document">>>;
type WorkerInstanceType = Expect<Equal<typeof localWorker, WorkerInstance>>;
type DocumentInstanceType = Expect<Equal<typeof localDocument, DocumentInstance>>;
type RegisteredWorkerType = Expect<Equal<typeof registeredWorker, WorkerInstance>>;
type RegisteredDocumentType = Expect<Equal<typeof registeredDocument, DocumentInstance>>;
type RegisteredFrameType = Expect<Equal<typeof registeredFrame, FrameInstance>>;

// @ts-expect-error: The generated popup names constrain the original API.
api.changePopup("unknown");
// @ts-expect-error: The generated sidebar names constrain the original API.
api.changeSidebar("unknown");
// @ts-expect-error: Both icon APIs use the generated names.
api.changeActionIcon("unknown");
// @ts-expect-error: Both icon APIs use the generated names.
api.changeSidebarIcon("unknown");
// @ts-expect-error: Collection keys use the same registry as the setter.
api.getPopups().get("unknown");
// @ts-expect-error: Collection keys use the same registry as the setter.
api.getSidebars().get("unknown");
// @ts-expect-error: Collection keys use the same registry as the setter.
api.getIcons().get("unknown");
// @ts-expect-error: A remote service requires a registered name.
api.getService("unknown");
// @ts-expect-error: Local and remote services share the registry.
service.getService("unknown");
// @ts-expect-error: A remote offscreen requires a registered name.
api.getOffscreen("unknown");
// @ts-expect-error: Local and remote offscreens share the registry.
offscreen.getOffscreen("unknown");
// @ts-expect-error: A sandbox requires a registered name.
api.getSandbox("unknown");
// @ts-expect-error: Transport method arguments remain typed.
worker.run(1);
// @ts-expect-error: Transport method arguments remain typed.
document.parse(1);
// @ts-expect-error: Transport method arguments remain typed.
frame.render(1);
