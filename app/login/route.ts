import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirectToAuthorizationUrl } from "@/lib/auth/auth-redirect-intents";
import { getPublicOrigin, getPublicUrl } from "@/lib/auth/public-url";

export async function GET(request: Request) {
  const publicOrigin = getPublicOrigin(request);
  const redirectUri = `${publicOrigin}/callback`;
  const authorizationUrl = await getSignInUrl({
    redirectUri,
  });
  const url = getPublicUrl(request.url, request);
  return redirectToAuthorizationUrl(authorizationUrl, url);
}
