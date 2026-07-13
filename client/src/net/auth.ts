import { HTTP_BASE } from "./room";

/**
 * Client-side auth: talk to the server's /auth/* endpoints and keep the
 * session token in localStorage. The token (not a guessable id) is what the
 * client presents when joining a zone room.
 */

const TOKEN_KEY = "mmo:token";

export interface AuthResult {
  token: string;
  username: string;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function post(
  path: string,
  body: Record<string, string | boolean | undefined>,
): Promise<AuthResult> {
  const res = await fetch(`${HTTP_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<AuthResult> & { error?: string };
  if (!res.ok || !data.token) {
    throw new Error(data.error ?? "Couldn't reach the server. Try again.");
  }
  return { token: data.token, username: data.username ?? "" };
}

export const registerAccount = (
  username: string,
  password: string,
  ironman = false,
): Promise<AuthResult> => post("/auth/register", { username, password, ironman });

export const loginAccount = (username: string, password: string): Promise<AuthResult> =>
  post("/auth/login", { username, password });

export const guestLogin = (name?: string): Promise<AuthResult> => post("/auth/guest", { name });
