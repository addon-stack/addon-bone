import type {ContentScriptContainerOptions, ContentScriptContainerTag, ContentScriptIsolation} from "./common";
import type {ContentScriptBoundaryProps} from "./boundary";

export type ContentScriptTargetTag = ContentScriptContainerTag;
export type ContentScriptTargetOptions = ContentScriptContainerOptions;

/** Available after isolation exists, before the target is created or rendering starts. */
export interface ContentScriptTargetProps<
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
> extends ContentScriptBoundaryProps<Data, Isolation> {
    /** Create elements in this document, including for an iframe's child document. */
    document: Document;
}

export type ContentScriptTargetFactory<
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
> = (props: ContentScriptTargetProps<Data, Isolation>) => Element | ContentScriptTargetTag | ContentScriptTargetOptions;

export type ContentScriptTarget<
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
> = ContentScriptTargetTag | ContentScriptTargetOptions | ContentScriptTargetFactory<Data, Isolation>;

/** Synchronous DOM creation; asynchronous work belongs in prepare. */
export type ContentScriptTargetCreator<Data = unknown> = (props: ContentScriptTargetProps<Data>) => Element;
