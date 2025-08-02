import { Filter } from '.';
import { ImageData } from '../Image';
export default class FloydSteinberg implements Filter {
    process(image: ImageData): ImageData;
}
