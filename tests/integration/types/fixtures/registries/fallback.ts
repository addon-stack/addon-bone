import * as api from "adnbn";
import type {ServiceName} from "adnbn/service";
import type {OffscreenName} from "adnbn/offscreen";
import type {SandboxName} from "adnbn/sandbox";
import type {Equal, Expect} from "./assert";

type PopupNames = Expect<Equal<api.PopupAlias, string>>;
type SidebarNames = Expect<Equal<api.SidebarAlias, string>>;
type IconNames = Expect<Equal<api.IconName, string>>;
type ServiceNames = Expect<Equal<ServiceName, never>>;
type OffscreenNames = Expect<Equal<OffscreenName, never>>;
type SandboxNames = Expect<Equal<SandboxName, never>>;

api.changePopup("custom");
api.changeSidebar("custom");
api.changeActionIcon("custom");
api.changeSidebarIcon();

// @ts-expect-error: Empty transport registries remain strict.
api.getService("unknown");
// @ts-expect-error: Empty transport registries remain strict.
api.getOffscreen("unknown");
// @ts-expect-error: Empty transport registries remain strict.
api.getSandbox("unknown");
