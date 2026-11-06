import { env } from 'cloudflare:workers';
import { handleApi } from '../../../server/api.mjs';
import { D1Store } from '../../../server/store.mjs';
export const dynamic = 'force-dynamic';
function route(request: Request) {
  return handleApi(request, {store:new D1Store(env.DB!), secret:env.VIDEO_CONFIG_KEY});
}
export const GET = route;
export const POST = route;
export const PUT = route;
export const DELETE = route;
