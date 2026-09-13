export const isolation = {type: "iframe", page: "panel"};

export default function render() {
    return {ping: () => "pong"};
}
