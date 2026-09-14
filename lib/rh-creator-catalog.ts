import catalog from '../third_party/runninghub/capabilities.json';
import type { RhModel } from './rh-creator-schema';
export const rhCatalog = catalog.endpoints as RhModel[];
export const rhCatalogVersion = catalog.version;
export function creatorModel(endpoint:string) { return rhCatalog.find(m=>m.endpoint===endpoint); }
