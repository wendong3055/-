import {readSiteAsset} from '../../lib/site-asset-store';
// Same URLs as the former bundled public files; exact allowlist only.
export async function GET(_request:Request,context:{params:Promise<{asset:string[]}>}){return readSiteAsset('/'+(await context.params).asset.join('/'));}
