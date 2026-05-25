import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';

interface JwtPayload {
  sub: string;
  email: string;
  username?: string;
  exp?: number;
  iat?: number;
}

const COOKIE_NAME = 'accessToken';

export function getToken(): string | null {
  return Cookies.get(COOKIE_NAME) ?? null;
}

export function setToken(token: string, days = 7): void {
  Cookies.set(COOKIE_NAME, token, {
    expires: days,
    secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
    sameSite: 'lax',
  });
}

export function clearToken(): void {
  Cookies.remove(COOKIE_NAME);
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwtDecode<JwtPayload>(token);
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, clockSkewSeconds = 30): boolean {
  const payload = decodeToken(token);
  if (!payload?.exp) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp - clockSkewSeconds <= nowSeconds;
}

/**
 * Returns the current token if it's valid and not near expiry.
 * Otherwise clears the cookie and returns null.
 */
export function getValidToken(): string | null {
  const token = getToken();
  if (!token) return null;
  if (isTokenExpired(token)) {
    clearToken();
    return null;
  }
  return token;
}
