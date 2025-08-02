import Model from './Model';
import { Connection } from './connection';
import { StyleConf } from './profile';
import { Cut, Drawer, Align } from './actions';
import { SupportedModel } from './capabilities';
import Image from './graphics/Image';
import Manager from './graphics/Manager';
export default class Printer {
    private model;
    constructor(model: Model);
    setCodepage(value: string): Promise<void>;
    buzzer(): Promise<void>;
    cutter(mode?: Cut): Promise<void>;
    drawer(number?: Drawer, on_time?: number, off_time?: number): Promise<void>;
    draw(image: Image): Promise<void>;
    qrcode(data: string, size?: number): Promise<void>;
    setAlignment(align: Align): Promise<void>;
    write(text: string, styles?: number): Promise<void>;
    writeln(text?: string, styles?: number, align?: Align): Promise<void>;
    withStyle(styleConf: StyleConf, cb: Function): Promise<void>;
    feed(lines?: number): Promise<void>;
    get columns(): number;
    setColumns(value: number): Promise<void>;
    close(): Promise<void>;
    static CONNECT(_model: SupportedModel | Model, connection: Connection, imageManager?: Manager): Promise<Printer>;
}
