/// <reference types="node" />
import { Filter } from './filter';
export interface ImageData {
    readonly data: Buffer;
    readonly height: number;
    readonly width: number;
}
export default class Image {
    data: Buffer;
    lines: number;
    width: number;
    bytesPerRow: number;
    constructor(imageData?: ImageData, filter?: Filter);
    private readImage;
    lineData(index: number): Buffer;
}
