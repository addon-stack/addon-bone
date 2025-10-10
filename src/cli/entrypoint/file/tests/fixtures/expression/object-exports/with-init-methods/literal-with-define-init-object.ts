import {defineService} from "adnbn";
import {MessageSenderAware} from "adnbn/message";

export default defineService({
    init() {
        return {
            async ping(): Promise<void> {
                console.log('pong');
            }
        } as MessageSenderAware;
    }
});