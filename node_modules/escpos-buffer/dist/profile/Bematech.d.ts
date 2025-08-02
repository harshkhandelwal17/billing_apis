import Epson from './Epson';
import { Style, Drawer } from '../actions';
import { Font } from '../capabilities';
export default class Bematech extends Epson {
    protected setStyle(style: Style, enable: boolean): Promise<void>;
    buzzer(): Promise<void>;
    drawer(number: Drawer, on_time: number, off_time: number): Promise<void>;
    qrcode(data: string, size: number): Promise<void>;
    protected fontChanged(current: Font, previous: Font): Promise<void>;
}
