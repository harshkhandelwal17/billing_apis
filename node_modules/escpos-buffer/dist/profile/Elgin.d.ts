import Epson from './Epson';
import { Style, Cut, Drawer } from '../actions';
export default class Elgin extends Epson {
    cutter(mode: Cut): Promise<void>;
    buzzer(): Promise<void>;
    drawer(number: Drawer, on_time: number, off_time: number): Promise<void>;
    protected setStyle(style: Style, enable: boolean): Promise<void>;
    protected setMode(mode: number, enable: boolean): Promise<void>;
    qrcode(data: string, size: number): Promise<void>;
}
