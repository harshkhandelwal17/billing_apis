import Elgin from './Elgin';
import { Cut, Drawer } from '../actions';
import { Font } from '../capabilities';
export default class Diebold extends Elgin {
    buzzer(): Promise<void>;
    initialize(): Promise<void>;
    protected fontChanged(_: Font, __: Font): Promise<void>;
    cutter(_: Cut): Promise<void>;
    drawer(number: Drawer, on_time: number, off_time: number): Promise<void>;
}
