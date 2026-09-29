import {headSiteAsset,writeSiteAsset} from '../../../../lib/site-asset-store';
// Shared built-in files on the owner-private Site: dispatch authenticates both
// the owner and the supported service caller. Exact hash-allowlisted bytes only.
export async function HEAD(_request:Request,context:{params:Promise<{hash:string}>}){return headSiteAsset((await context.params).hash);}
export async function PUT(request:Request,context:{params:Promise<{hash:string}>}){return writeSiteAsset(request,(await context.params).hash);}
