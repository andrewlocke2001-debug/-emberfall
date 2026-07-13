import { randomUUID } from "node:crypto";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./persistence/db";

/**
 * Accounts + signed session tokens. Passwords are argon2-hashed; identity is a
 * short-claim HS256 JWT the client stores and presents on join. The server
 * verifies the token and derives the account id from it — a client can never
 * claim to be someone else by editing a localStorage id (the pre-auth model).
 */

const secretStr = process.env["SESSION_SECRET"];
if (!secretStr) {
  console.warn(
    "[auth] SESSION_SECRET is not set — using an INSECURE dev default. " +
      "Set a real one (e.g. `fly secrets set SESSION_SECRET=...`) before exposing the server.",
  );
}
const SECRET = new TextEncoder().encode(secretStr ?? "dev-insecure-secret-change-me");
const TOKEN_TTL = "30d";
const USERNAME_RE = /^[A-Za-z0-9 _-]{1,24}$/;

/** Thrown for expected, user-facing auth failures (surfaced as 400s). */
export class AuthError extends Error {}

export interface AuthClaims {
  accountId: string;
  username: string;
  /** Ironman mode (P10): permanent, chosen at registration; gates trading. */
  ironman: boolean;
}
export interface AuthResult {
  token: string;
  username: string;
}

async function issueToken(accountId: string, username: string, ironman = false): Promise<string> {
  return new SignJWT({ username, ironman })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(accountId)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(SECRET);
}

/** Verify a session token; returns the claims or null if invalid/expired. */
export async function verifyToken(token: string): Promise<AuthClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const username = payload["username"];
    if (typeof payload.sub !== "string" || typeof username !== "string") return null;
    return { accountId: payload.sub, username, ironman: payload["ironman"] === true };
  } catch {
    return null;
  }
}

export async function registerAccount(
  username: string,
  password: string,
  ironman = false,
): Promise<AuthResult> {
  const name = (username ?? "").trim();
  if (!USERNAME_RE.test(name)) {
    throw new AuthError("Username must be 1–24 letters, numbers, spaces, _ or -.");
  }
  if (typeof password !== "string" || password.length < 6) {
    throw new AuthError("Password must be at least 6 characters.");
  }
  if (await prisma.account.findUnique({ where: { username: name } })) {
    throw new AuthError("That username is taken.");
  }
  const account = await prisma.account.create({
    data: { username: name, passwordHash: await argonHash(password), isGuest: false, ironman: ironman === true },
  });
  return {
    token: await issueToken(account.id, account.username, account.ironman),
    username: account.username,
  };
}

export async function loginAccount(username: string, password: string): Promise<AuthResult> {
  const account = await prisma.account.findUnique({ where: { username: (username ?? "").trim() } });
  // Same message for unknown user / wrong password / guest account — don't leak which.
  if (!account || account.isGuest || !(await argonVerify(account.passwordHash, password ?? ""))) {
    throw new AuthError("Wrong username or password.");
  }
  return {
    token: await issueToken(account.id, account.username, account.ironman),
    username: account.username,
  };
}

export async function guestAccount(desiredName?: string): Promise<AuthResult> {
  const base = (desiredName ?? "").trim();
  const username = await uniqueGuestName(base && USERNAME_RE.test(base) ? base : "Guest");
  const account = await prisma.account.create({
    // Guests never type a password; hash a random value so the column is valid.
    data: { username, passwordHash: await argonHash(randomUUID()), isGuest: true },
  });
  return { token: await issueToken(account.id, account.username), username: account.username };
}

async function uniqueGuestName(base: string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate =
      i === 0 && base !== "Guest" ? base : `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await prisma.account.findUnique({ where: { username: candidate } }))) return candidate;
  }
  return `Guest-${randomUUID().slice(0, 8)}`;
}
