import { Filter } from '.';
import { ImageData } from '../Image';
export default class Threshold implements Filter {
    process(image: ImageData): ImageData;
}
