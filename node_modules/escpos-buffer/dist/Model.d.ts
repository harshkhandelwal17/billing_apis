import { Profile } from './profile';
import { Capability, SupportedModel } from './capabilities';
export default class Model {
    private _profile;
    constructor(model: Profile | SupportedModel);
    private static initialiseProfile;
    static ASSIGN_DEFINED(target: object, ...others: object[]): object;
    static FIND(model: string): object;
    static EXPAND(profile: any): Capability;
    static ALL(): Capability[];
    get name(): string;
    get profile(): Profile;
}
