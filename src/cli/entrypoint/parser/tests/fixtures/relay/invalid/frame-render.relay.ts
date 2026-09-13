export const isolation = {type: "iframe", page: "panel"};

export function render() {
    return "UI";
}
export default () => ({ping: () => "pong"});
