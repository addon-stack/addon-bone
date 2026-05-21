type EvalResult =
    | {
          ok: true;
          type: string;
          value: string;
      }
    | {
          ok: false;
          name: string;
          message: string;
          stack?: string;
      };

class MultilineUnionAlias {
    public evaluate(code: string): Promise<EvalResult> {
        return Promise.resolve({
            ok: true,
            type: "string",
            value: code,
        });
    }
}

export default () => new MultilineUnionAlias();
