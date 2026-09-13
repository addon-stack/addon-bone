export default {
    enabled: true,
    handler() {
        throw new Error("Export analysis must not execute object methods");
    },
};
