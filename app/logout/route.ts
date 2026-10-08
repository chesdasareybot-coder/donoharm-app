import { withAuth } from "@workos-inc/authkit-nextjs";
import { workos } from "@/app/api/workos";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicOrigin } from "@/lib/auth/public-url";

export const GET = async (request: NextRequest) => {
  const returnTo = getPublicOrigin(request);

  try {
    const auth = await withAuth();
    if (auth?.sessionId) {
      await workos.userManagement.revokeSession({ sessionId: auth.sessionId }).catch(() => {});
    }
  } catch {
    // ignore session lookup failures
  }

  const response = NextResponse.redirect(returnTo, { status: 307 });

  const cookieNames = [
    "wos-session",
    "wos-session-v2",
    "wos-user",
  ];

  for (const name of cookieNames) {
    response.cookies.delete(name);
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
  }

  // Also clear any cookies starting with wos- or workos (like PKCE cookies)
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("wos-") || cookie.name.startsWith("workos")) {
      response.cookies.delete(cookie.name);
      response.cookies.set(cookie.name, "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
    }
  }

  return response;
};
