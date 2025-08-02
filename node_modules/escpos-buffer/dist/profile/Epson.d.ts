import { Align, Style, Cut, Drawer } from '../actions';
import { Profile } from '.';
import { Font } from '../capabilities';
export default class Epson extends Profile {
    feed(lines: number): Promise<void>;
    cutter(_: Cut): Promise<void>;
    buzzer(): Promise<void>;
    drawer(number: Drawer, on_time: number, off_time: number): Promise<void>;
    setAlignment(align: Align): Promise<void>;
    protected setMode(mode: number, enable: boolean): Promise<void>;
    protected setStyle(style: Style, enable: boolean): Promise<void>;
    protected setCharSize({ width, height, }: {
        width: number;
        height: number;
    }): Promise<void>;
    qrcode(data: string, size: number): Promise<void>;
    protected fontChanged(current: Font, previous: Font): Promise<void>;
}
