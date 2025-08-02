/// <reference types="w3c-web-usb" />
/// <reference types="node" />
import { Connection } from '.';
export default class WebUSB implements Connection {
    private device;
    private configurationValue;
    private interfaceNumber;
    private endpointNumber;
    constructor(device: USBDevice, configurationValue?: number, interfaceNumber?: number);
    open(): Promise<void>;
    write(data: Buffer): Promise<void>;
    close(): Promise<void>;
    autoSelect(): void;
}
