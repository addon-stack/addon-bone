/** An original stylesheet whose location remains the base for its local requests. */
export type StyleSource = {
    filename: string;
    content: string;
};

/** Reports every local file candidate that can change how a Sass request resolves. */
export type StyleDependencyHandler = (filename: string, exists: boolean) => void;
