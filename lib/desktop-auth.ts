import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";
import os from "os";

const TRANSFER_TOKEN_TTL_SECONDS = 300;
const OAUTH_STATE_TTL_SECONDS = 300;
const TRANSFER_TOKEN_PREFIX = "desktop-auth-transfer:";
const OAUTH_STATE_PREFIX = "desktop-oauth-state:";
const TOKEN_FORMAT_REGEX = /^[a-f0-9]{64}$/;

const DISK_AUTH_DIR = path.join(os.tmpdir(), "donoharm_desktop_auth");

function ensureDiskAuthDir(): void {
  try {
    if (!fs.existsSync(DISK_AUTH_DIR)) {
      fs.mkdirSync(DISK_AUTH_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("[Desktop Auth] Failed to create disk auth directory:", err);
  }
}

function writeDiskState<T>(
  prefix: string,
  key: string,
  data: T,
  ttlSeconds: number,
): void {
  try {
    ensureDiskAuthDir();
    const filePath = path.join(DISK_AUTH_DIR, `${prefix}_${key}.json`);
    const payload = {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload), "utf-8");
  } catch (err) {
    console.error(`[Desktop Auth] Failed to write ${prefix} to disk:`, err);
  }
}

function readAndConsumeDiskState<T>(prefix: string, key: string): T | null {
  try {
    const filePath = path.join(DISK_AUTH_DIR, `${prefix}_${key}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    try {
      fs.unlinkSync(filePath);
    } catch {}
    const parsed = JSON.parse(content);
    if (
      parsed &&
      typeof parsed.expiresAt === "number" &&
      parsed.expiresAt > Date.now()
    ) {
      return parsed.data as T;
    }
    return null;
  } catch (err) {
    console.error(`[Desktop Auth] Failed to read ${prefix} from disk:`, err);
    return null;
  }
}

type TransferTokenData = {
  sealedSession: string;
  createdAt: number;
  returnPath?: string;
  desktopAuthState?: string;
};

function getRedis(): Redis | null {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return null;
  }

  return new Redis({
    url: redisUrl,
    token: redisToken,
  });
}

function generateTransferToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

type MemoryStoreEntry<T> = {
  data: T;
  expiresAt: number;
};

type DesktopAuthMemoryStore = {
  transferTokens: Map<string, MemoryStoreEntry<TransferTokenData>>;
  oauthStates: Map<string, MemoryStoreEntry<string>>;
};

declare global {
  var __desktopAuthMemoryStore: DesktopAuthMemoryStore | undefined;
}

function getMemoryStore(): DesktopAuthMemoryStore {
  if (!globalThis.__desktopAuthMemoryStore) {
    globalThis.__desktopAuthMemoryStore = {
      transferTokens: new Map(),
      oauthStates: new Map(),
    };
  }
  return globalThis.__desktopAuthMemoryStore;
}

export async function createDesktopTransferToken(
  sealedSession: string,
  options?: { returnPath?: string; desktopAuthState?: string },
): Promise<string | null> {
  const transferToken = generateTransferToken();
  const data: TransferTokenData = {
    sealedSession,
    createdAt: Date.now(),
  };
  if (options?.returnPath) {
    data.returnPath = options.returnPath;
  }
  if (options?.desktopAuthState) {
    data.desktopAuthState = options.desktopAuthState;
  }

  const redis = getRedis();
  if (redis) {
    const key = `${TRANSFER_TOKEN_PREFIX}${transferToken}`;
    try {
      await redis.set(key, data, { ex: TRANSFER_TOKEN_TTL_SECONDS });
      return transferToken;
    } catch (err) {
      console.error(
        "[Desktop Auth] Failed to store transfer token in Redis:",
        err,
      );
      return null;
    }
  }

  // Cross-process disk fallback for multi-worker Node.js hosting (e.g. Hostinger)
  writeDiskState("transfer", transferToken, data, TRANSFER_TOKEN_TTL_SECONDS);

  // In-memory fallback for local development without Redis
  const store = getMemoryStore();
  const now = Date.now();
  for (const [k, v] of store.transferTokens.entries()) {
    if (v.expiresAt <= now) {
      store.transferTokens.delete(k);
    }
  }
  store.transferTokens.set(transferToken, {
    data,
    expiresAt: now + TRANSFER_TOKEN_TTL_SECONDS * 1000,
  });
  return transferToken;
}

export async function exchangeDesktopTransferToken(
  transferToken: string,
  options?: { desktopAuthState?: string },
): Promise<{
  sealedSession: string;
  returnPath?: string;
} | null> {
  if (!TOKEN_FORMAT_REGEX.test(transferToken)) {
    console.warn("[Desktop Auth] Invalid transfer token format");
    return null;
  }

  const redis = getRedis();
  let data: TransferTokenData | null = null;

  if (redis) {
    const key = `${TRANSFER_TOKEN_PREFIX}${transferToken}`;
    let rawData: TransferTokenData | string | null;
    try {
      // Use getdel for atomic get-and-delete to prevent race conditions
      rawData = await redis.getdel<TransferTokenData>(key);
    } catch (err) {
      console.error(
        "[Desktop Auth] Failed to retrieve transfer token from Redis:",
        err,
      );
      return null;
    }

    if (!rawData) {
      console.warn("[Desktop Auth] Transfer token not found or expired");
      return null;
    }

    if (typeof rawData === "object") {
      // Upstash auto-deserialized the JSON
      data = rawData as unknown as TransferTokenData;
    } else {
      try {
        data = JSON.parse(rawData) as TransferTokenData;
      } catch (err) {
        console.error(
          "[Desktop Auth] Failed to parse transfer token data:",
          err,
        );
        return null;
      }
    }
  } else {
    // Cross-process disk fallback first
    data = readAndConsumeDiskState<TransferTokenData>(
      "transfer",
      transferToken,
    );

    // In-memory fallback if not found on disk
    if (!data) {
      const store = getMemoryStore();
      const entry = store.transferTokens.get(transferToken);
      if (entry) {
        store.transferTokens.delete(transferToken);
        if (entry.expiresAt > Date.now()) {
          data = entry.data;
        }
      }
    }
  }

  if (
    !data ||
    typeof data.sealedSession !== "string" ||
    data.sealedSession.length === 0
  ) {
    console.warn("[Desktop Auth] Invalid or expired transfer token payload");
    return null;
  }

  if (data.desktopAuthState && !options?.desktopAuthState) {
    console.warn("[Desktop Auth] Desktop auth state required but not provided");
    return null;
  }

  if (
    options?.desktopAuthState &&
    data.desktopAuthState !== options.desktopAuthState
  ) {
    console.warn("[Desktop Auth] Desktop auth state mismatch");
    return null;
  }

  const result: { sealedSession: string; returnPath?: string } = {
    sealedSession: data.sealedSession,
  };
  if (typeof data.returnPath === "string") {
    result.returnPath = data.returnPath;
  }
  return result;
}

export type OAuthStateMetadata = {
  devCallbackPort?: number;
  returnPath?: string;
  desktopAuthState?: string;
};

export async function createOAuthState(
  metadata?: OAuthStateMetadata,
): Promise<string | null> {
  const state = generateTransferToken();
  const value = metadata ? JSON.stringify(metadata) : "1";

  const redis = getRedis();
  if (redis) {
    const key = `${OAUTH_STATE_PREFIX}${state}`;
    try {
      await redis.set(key, value, { ex: OAUTH_STATE_TTL_SECONDS });
      return state;
    } catch (err) {
      console.error(
        "[Desktop Auth] Failed to store OAuth state in Redis:",
        err,
      );
      return null;
    }
  }

  // Cross-process disk fallback for multi-worker Node.js hosting (e.g. Hostinger)
  writeDiskState("oauth", state, value, OAUTH_STATE_TTL_SECONDS);

  // In-memory fallback for local development without Redis
  const store = getMemoryStore();
  const now = Date.now();
  for (const [k, v] of store.oauthStates.entries()) {
    if (v.expiresAt <= now) {
      store.oauthStates.delete(k);
    }
  }
  store.oauthStates.set(state, {
    data: value,
    expiresAt: now + OAUTH_STATE_TTL_SECONDS * 1000,
  });

  return state;
}

export async function verifyAndConsumeOAuthState(
  state: string,
): Promise<{ valid: boolean; metadata?: OAuthStateMetadata }> {
  if (!TOKEN_FORMAT_REGEX.test(state)) {
    console.warn("[Desktop Auth] Invalid OAuth state format");
    return { valid: false };
  }

  const redis = getRedis();
  let value: string | null = null;

  if (redis) {
    const key = `${OAUTH_STATE_PREFIX}${state}`;
    try {
      value = await redis.getdel<string>(key);
    } catch (err) {
      console.error(
        "[Desktop Auth] Failed to verify OAuth state in Redis:",
        err,
      );
      return { valid: false };
    }
  } else {
    // Cross-process disk fallback first
    value = readAndConsumeDiskState<string>("oauth", state);

    // In-memory fallback if not found on disk
    if (!value) {
      const store = getMemoryStore();
      const entry = store.oauthStates.get(state);
      if (entry) {
        store.oauthStates.delete(state);
        if (entry.expiresAt > Date.now()) {
          value = entry.data;
        }
      }
    }
  }

  if (!value) {
    return { valid: false };
  }

  if (value === "1") {
    return { valid: true };
  }

  try {
    const metadata =
      typeof value === "object"
        ? (value as unknown as OAuthStateMetadata)
        : (JSON.parse(value) as OAuthStateMetadata);
    return { valid: true, metadata };
  } catch {
    // If we can't parse metadata, state is still valid
    return { valid: true };
  }
}
