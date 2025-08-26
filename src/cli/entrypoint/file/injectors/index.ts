import core from "./core";
import {Injector} from "../types";

export default (resolvers: Injector[]) =>
    (from: string, target: string, name: string): any => {
        return [...resolvers, ...core()].find(
            resolver => resolver.from === from && resolver.target === target && resolver.name === name
        )?.value;
    };
