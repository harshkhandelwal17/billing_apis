import { Filter } from '.';
import { ImageData } from '../Image';
export default class BayerOrdered implements Filter {
    process(image: ImageData): ImageData;
}
