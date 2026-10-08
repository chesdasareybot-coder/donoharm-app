import { SignJWT } from "jose";

export async function generateCentrifugoToken(
  userId: string,
  expSeconds: number,
): Promise<string> {
  const secret =
    process.env.CENTRIFUGO_TOKEN_SECRET ||
    "donoharm_centrifugo_secret_token_key_2026";

  const encodedSecret = new TextEncoder().encode(secret);

  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(`${expSeconds}s`)
    .sign(encodedSecret);
}
