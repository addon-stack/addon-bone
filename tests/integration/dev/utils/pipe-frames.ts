export type PipeFrameHandler = (frame: string) => void;

export type PipeFrameReader = (chunk: Buffer) => void;

/**
 * Splits a byte stream into NUL-terminated UTF-8 frames. NUL never occurs inside a multibyte UTF-8 sequence, so a
 * frame is decoded only after all of its bytes have arrived, wherever the pipe split the chunks.
 */
export const createPipeFrameReader = (onFrame: PipeFrameHandler): PipeFrameReader => {
    let pending: Buffer = Buffer.alloc(0);

    return chunk => {
        pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;

        let index = pending.indexOf(0);

        while (index >= 0) {
            onFrame(pending.subarray(0, index).toString("utf8"));
            pending = pending.subarray(index + 1);
            index = pending.indexOf(0);
        }
    };
};
