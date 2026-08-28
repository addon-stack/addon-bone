import {RelayAllFrames, type RelayBatchOptions, type RelayCallOptions} from "@typing/relay";

export default abstract class RelayAdapter {
    protected constructor(
        protected readonly name: string,
        protected readonly target: RelayCallOptions
    ) {}

    protected isBatchTarget(target: RelayCallOptions): target is RelayBatchOptions {
        return (
            target.allFrames === true ||
            target.allFrames === RelayAllFrames.Any ||
            target.allFrames === RelayAllFrames.All ||
            target.frameIds !== undefined ||
            target.documentIds !== undefined
        );
    }

    public abstract invoke(args: any[], path?: string): Promise<any>;
}
