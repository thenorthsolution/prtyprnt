
export type DefaultEventMap = [never];
export type AnyRest = [...args: any[]];
export type Key<K, T> = T extends DefaultEventMap ? string | symbol : K | keyof T;
export type Args<K, T> = T extends DefaultEventMap ? AnyRest : (
    K extends keyof T ? T[K] : never
);