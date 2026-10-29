import {createPipeFrameReader} from "./pipe-frames";

const collect = () => {
    const frames: string[] = [];

    return {frames, read: createPipeFrameReader(frame => frames.push(frame))};
};

const frame = (value: unknown): Buffer => Buffer.from(JSON.stringify(value) + "\0", "utf8");

describe("createPipeFrameReader", () => {
    test("decodes a frame whose chunks split a multibyte character", () => {
        const {frames, read} = collect();
        const bytes = frame({id: 1, error: {message: "Ошибка"}});
        // "О" takes two bytes in UTF-8; cut between them.
        const cut = bytes.indexOf(Buffer.from("О", "utf8")) + 1;

        read(bytes.subarray(0, cut));
        read(bytes.subarray(cut));

        expect(frames.map(text => JSON.parse(text))).toEqual([{id: 1, error: {message: "Ошибка"}}]);
    });

    test("emits every frame contained in one chunk in order", () => {
        const {frames, read} = collect();

        read(Buffer.concat([frame({id: 1}), frame({id: 2}), frame({method: "Target.attachedToTarget"})]));

        expect(frames.map(text => JSON.parse(text))).toEqual([{id: 1}, {id: 2}, {method: "Target.attachedToTarget"}]);
    });

    test("joins a frame delivered one byte at a time", () => {
        const {frames, read} = collect();
        const bytes = frame({url: "chrome-extension://abc/страница.html"});

        for (const byte of bytes) {
            read(Buffer.from([byte]));
        }

        expect(frames.map(text => JSON.parse(text))).toEqual([{url: "chrome-extension://abc/страница.html"}]);
    });

    test("keeps an unterminated tail until its delimiter arrives", () => {
        const {frames, read} = collect();
        const bytes = frame({id: 3});

        read(Buffer.concat([frame({id: 2}), bytes.subarray(0, -1)]));

        expect(frames).toEqual([JSON.stringify({id: 2})]);

        read(bytes.subarray(-1));

        expect(frames).toEqual([JSON.stringify({id: 2}), JSON.stringify({id: 3})]);
    });
});
