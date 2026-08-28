import {getBrowserInfo, sendMessage, sendTabMessage} from "@addon-core/browser";

import {markRemoteMessageError, restoreError, UnsupportedMessageTargetError} from "../error";

import {isBrowser} from "@main/env";

import {
    MessageBody,
    MessageData,
    MessageDictionary,
    MessageError,
    MessageGeneralHandler,
    MessageHandler,
    MessageMapHandler,
    MessageResult,
    MessageResultEnvelopeProperty,
    MessageResponse,
    MessageSendOptions,
    MessageTargetHandler,
    MessageType,
} from "@typing/message";
import {Browser} from "@typing/browser";

import AbstractMessage from "./AbstractMessage";
import MessageManager from "../MessageManager";

import {GeneralHandler, MapHandler, SingleHandler} from "../handlers";

export default class Message<T extends MessageDictionary> extends AbstractMessage<T, MessageSendOptions> {
    private static readonly FirefoxDocumentIdMinVersion = 153;
    private static instance: Message<MessageDictionary> | null = null;
    private firefoxDocumentIdVersion?: Promise<{major: number; version: string}>;

    public static getInstance<T extends MessageDictionary>() {
        return (this.instance ??= new Message<T>());
    }

    protected get manager(): MessageManager<T> {
        return MessageManager.getInstance<T>();
    }

    public async send<K extends MessageType<T>>(
        type: K,
        data: MessageData<T, K>,
        options?: MessageSendOptions
    ): Promise<MessageResponse<T, K>> {
        const message = this.buildMessage(type, data);
        const response = await this.dispatch(message, options);

        return this.unwrap(response);
    }

    private async dispatch<K extends MessageType<T>>(
        message: MessageBody<T, K>,
        options?: MessageSendOptions
    ): Promise<MessageResult<MessageResponse<T, K>> | MessageResponse<T, K> | undefined> {
        if (options === undefined) {
            return sendMessage(message);
        }

        if (typeof options === "number") {
            return sendTabMessage(options, message);
        }

        const {tabId, ...other} = options;

        if (other.documentId !== undefined && isBrowser(Browser.Firefox)) {
            await this.assertFirefoxDocumentTargetSupport();
        }

        return sendTabMessage(tabId, message, other);
    }

    private unwrap<K extends MessageType<T>>(
        response: MessageResult<MessageResponse<T, K>> | MessageResponse<T, K> | undefined
    ): MessageResponse<T, K> {
        if (!this.isMessageResult(response)) {
            return response as MessageResponse<T, K>;
        }

        if (response.ok) {
            return response.payload;
        }

        throw markRemoteMessageError(restoreError(response.error));
    }

    private async assertFirefoxDocumentTargetSupport(): Promise<void> {
        this.firefoxDocumentIdVersion ??= getBrowserInfo().then(info => {
            const major = Number.parseInt(info.version.split(".")[0], 10);

            if (!Number.isInteger(major)) {
                throw new UnsupportedMessageTargetError(
                    `Cannot determine whether Firefox ${JSON.stringify(info.version)} supports documentId message targets.`
                );
            }

            return {major, version: info.version};
        });

        let browserVersion: {major: number; version: string};

        try {
            browserVersion = await this.firefoxDocumentIdVersion;
        } catch (error) {
            if (error instanceof UnsupportedMessageTargetError) {
                throw error;
            }

            throw new UnsupportedMessageTargetError(
                "Cannot determine whether the current Firefox version supports documentId message targets.",
                error
            );
        }

        if (browserVersion.major < Message.FirefoxDocumentIdMinVersion) {
            throw new UnsupportedMessageTargetError(
                `Messaging by documentId requires Firefox ${Message.FirefoxDocumentIdMinVersion} or newer; current version is ${browserVersion.version}.`
            );
        }
    }

    private isMessageResult(response: unknown): response is MessageResult {
        if (
            !this.isRecord(response) ||
            response[MessageResultEnvelopeProperty] !== true ||
            typeof response.ok !== "boolean"
        ) {
            return false;
        }

        if (response.ok) {
            return "payload" in response;
        }

        return this.isSerializedError(response.error);
    }

    private isSerializedError(error: unknown): error is MessageError {
        return (
            this.isRecord(error) &&
            typeof error.name === "string" &&
            typeof error.message === "string" &&
            (error.stack === undefined || typeof error.stack === "string")
        );
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null;
    }

    public watch<K extends MessageType<T>>(
        arg1: K | MessageMapHandler<T> | MessageGeneralHandler<T, K>,
        arg2?: MessageTargetHandler<T, K>
    ): () => void {
        let handler: MessageHandler<T>;

        if (typeof arg1 === "function") {
            handler = new GeneralHandler<T, K>(arg1);
        } else if (typeof arg1 === "object" && arg2 === undefined) {
            handler = new MapHandler<T>(arg1);
        } else if (typeof arg1 === "string" && arg2) {
            handler = new SingleHandler<T>(arg1, arg2);
        } else {
            throw new Error("Invalid arguments passed to watch()");
        }

        this.manager.add(handler);

        return () => this.manager.remove(handler);
    }
}
