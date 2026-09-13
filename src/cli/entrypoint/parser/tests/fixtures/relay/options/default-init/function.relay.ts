export const isolation = {type: "iframe", page: "panel"};

export default function init() {
    return {ping: () => "pong"};
}
