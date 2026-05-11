import {defineService} from "adnbn";
import type {MessageSenderAware} from "adnbn/message";

export default defineService({
    init() {
        return {
            async ping(this: MessageSenderAware): Promise<number | undefined> {
                return this.$sender?.tab?.id;
            }
        } as MessageSenderAware;
    }
});
