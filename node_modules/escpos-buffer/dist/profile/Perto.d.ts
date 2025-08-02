import Elgin from './Elgin';
import { Cut } from '../actions';
export default class Perto extends Elgin {
    buzzer(): Promise<void>;
    cutter(_: Cut): Promise<void>;
}
