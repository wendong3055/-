import catalog from '../third_party/runninghub/capabilities.json';
import type { RhModel } from './rh-creator-schema';
import {internationalImageModels,imageCatalogDate} from './international-image-catalog';
export const rhCatalog = [...internationalImageModels, ...(catalog.endpoints as RhModel[]).filter(m=>m.output_type!=='image')];
export const rhCatalogVersion = `${catalog.version}; international images ${imageCatalogDate}`;
// Legacy endpoints stay queryable; new image selections use the international namespace.
export function creatorModel(endpoint:string) { return rhCatalog.find(m=>m.endpoint===endpoint) || (catalog.endpoints as RhModel[]).find(m=>m.endpoint===endpoint); }
