import Epson from './Epson';
export default class TecToy extends Epson {
    feed(lines: number): Promise<void>;
    buzzer(): Promise<void>;
    qrcode(data: string, size: number): Promise<void>;
}
