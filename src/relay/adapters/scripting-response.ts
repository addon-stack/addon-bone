import type {MessageError} from "@typing/message";

export type RelayInvocationResult =
    | {
          ok: true;
          hasResult: false;
      }
    | {
          ok: true;
          hasResult: true;
          result: any;
      }
    | {
          ok: false;
          error: MessageError;
      };
