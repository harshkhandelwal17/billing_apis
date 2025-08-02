/// <reference types="node" />
import { Connection } from '.';
export default class InMemory implements Connection {
    list: Buffer[];
    open(): Promise<void>;
    write(data: Buffer): Promise<void>;
    close(): Promise<void>;
    buffer(): Buffer;
}
