/// <reference types="web-bluetooth" />
/// <reference types="node" />
import { Connection } from '.';
export default class WebBluetooth implements Connection {
    private device;
    private characteristic;
    constructor(device: BluetoothDevice);
    open(): Promise<void>;
    write(data: Buffer): Promise<void>;
    close(): Promise<void>;
}
