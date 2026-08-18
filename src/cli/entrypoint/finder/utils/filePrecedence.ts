import {EntrypointFile} from "@typing/entrypoint";

/**
 * Numeric values define the composition order from the least specific layer
 * to the most specific one. Consumers that merge values therefore let later
 * workspace layers override plugins, while singleton consumers select the
 * final candidate.
 */
export enum FileLayer {
    Plugin,
    Source,
    Shared,
    App,
    AppSource,
}

export type WorkspaceFileLayer = Exclude<FileLayer, FileLayer.Plugin>;

export enum FileSpecificity {
    Generic,
    Browser,
}

export interface FilePrecedence {
    layer: FileLayer;
    order?: number;
    sequence?: number;
    specificity?: FileSpecificity;
}

const precedence = new WeakMap<EntrypointFile, Required<FilePrecedence>>();

const normalize = ({
    layer,
    order = 0,
    sequence = 0,
    specificity = FileSpecificity.Generic,
}: FilePrecedence): Required<FilePrecedence> => ({
    layer,
    order,
    sequence,
    specificity,
});

const fallback = normalize({layer: FileLayer.Plugin});

const isWorkspaceFileLayer = (layer: string | FileLayer): layer is WorkspaceFileLayer => {
    return typeof layer === "number" && layer !== FileLayer.Plugin;
};

const workspaceFileLayers = Object.freeze(
    Object.values(FileLayer)
        .filter(isWorkspaceFileLayer)
        .sort((a, b) => b - a)
);

/**
 * Workspace discovery runs from highest to lowest priority. This lets
 * non-merge consumers stop at the first non-empty layer and ensures that
 * overlapping canonical paths keep their most specific layer.
 */
export const getWorkspaceFileLayers = (): readonly WorkspaceFileLayer[] => workspaceFileLayers;

export const setFilePrecedence = (file: EntrypointFile, value: FilePrecedence): EntrypointFile => {
    if (!precedence.has(file)) {
        precedence.set(file, normalize(value));
    }

    return file;
};

export const setFileSpecificity = (file: EntrypointFile, specificity: FileSpecificity): EntrypointFile => {
    precedence.set(file, {
        ...(precedence.get(file) ?? fallback),
        specificity,
    });

    return file;
};

export const getFilePrecedence = (file: EntrypointFile): Required<FilePrecedence> => {
    return precedence.get(file) ?? fallback;
};

export const compareFilePrecedence = (a: EntrypointFile, b: EntrypointFile): number => {
    const left = getFilePrecedence(a);
    const right = getFilePrecedence(b);

    return (
        left.layer - right.layer ||
        left.order - right.order ||
        left.specificity - right.specificity ||
        left.sequence - right.sequence
    );
};
