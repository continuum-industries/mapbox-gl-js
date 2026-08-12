import {warnOnce} from '../src/util/util';
import {Standard} from './standard_registry_esm';

export {Standard};

export async function prepareStandard(): Promise<void> {
    try {
        const {Standard: standardModule} = await import('./standard_main_imports');
        Object.assign(Standard, standardModule);
    } catch (error) {
        warnOnce('Could not load Standard module.');
    }
}
