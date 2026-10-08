import { NextRequest } from "next/server";
import { handleDesktopAuthCallback } from "@/lib/auth/desktop-callback-handler";

export async function GET(request: NextRequest) {
  return handleDesktopAuthCallback(request);
}
