import Epson from './Epson';
import { Align, Style, Drawer } from '../actions';
import { Font } from '../capabilities';
export default class Daruma extends Epson {
    drawer(number: Drawer, _: number, __: number): Promise<void>;
    setAlignment(align: Align): Promise<void>;
    protected setStyle(style: Style, enable: boolean): Promise<void>;
    protected setMode(mode: number, enable: boolean): Promise<void>;
    feed(lines: number): Promise<void>;
    initialize(): Promise<void>;
    protected fontChanged(current: Font, previous: Font): Promise<void>;
    qrcode(data: string, size: number): Promise<void>;
    protected get bitmapCmd(): string;
}
