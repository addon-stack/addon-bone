import type {ContentScriptBoundaryProps} from "adnbn";

export function setupBoundary({anchor, boundary}: ContentScriptBoundaryProps) {
    anchor.setAttribute("data-boundary-calls", String(Number(anchor.getAttribute("data-boundary-calls") ?? 0) + 1));
    const onProbe = () => {
        anchor.setAttribute(
            "data-boundary-events",
            String(Number(anchor.getAttribute("data-boundary-events") ?? 0) + 1)
        );
    };

    boundary.addEventListener("boundary-probe", onProbe);

    return () => {
        boundary.removeEventListener("boundary-probe", onProbe);
        boundary.dispatchEvent(new Event("boundary-probe"));
        anchor.setAttribute(
            "data-boundary-cleanups",
            String(Number(anchor.getAttribute("data-boundary-cleanups") ?? 0) + 1)
        );
    };
}
