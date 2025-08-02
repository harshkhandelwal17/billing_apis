import Epson from './Epson';
import { Style } from '../actions';
import { Font } from '../capabilities';
export default class ControliD extends Epson {
    protected setStyle(style: Style, enable: boolean): Promise<void>;
    qrcode(data: string, size: number): Promise<void>;
    initialize(): Promise<void>;
    protected fontChanged(current: Font, previous: Font): Promise<void>;
}
