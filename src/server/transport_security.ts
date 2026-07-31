import { isIP } from 'node:net';

export interface TransportSecurityInfo {
  remoteAddress?: string;
  encrypted: boolean;
  forwardedProto?: string;
  trustProxy?: boolean;
}

export function secureTransportAllowed(info: TransportSecurityInfo): boolean {
  if (info.encrypted) return true;
  if (info.trustProxy) {
    return info.forwardedProto
      ?.split(',')[0]
      .trim()
      .toLowerCase() === 'https';
  }
  return isLoopback(info.remoteAddress);
}

export function browserOriginAllowed(
  origin: string | undefined,
  remoteAddress: string | undefined,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  if (!origin) return true; // Native/CLI clients do not carry ambient browser authority.
  if (allowedOrigins.has(origin)) return true;
  if (!isLoopback(remoteAddress)) return false;
  try {
    return isLoopback(new URL(origin).hostname.replace(/^\[|\]$/g, ''));
  } catch {
    return false;
  }
}

export function sourceAddress(
  remoteAddress: string | undefined,
  forwardedFor: string | string[] | undefined,
  trustProxy: boolean,
): string {
  if (trustProxy) {
    const header = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const candidate = header?.split(',')[0].trim();
    if (candidate && isIP(candidate)) return candidate;
  }
  return remoteAddress ?? 'unknown';
}

function isLoopback(address: string | undefined): boolean {
  if (!address) return false;
  const normalized = address.toLowerCase();
  return normalized === '::1' || normalized === 'localhost' ||
    normalized.startsWith('127.') || normalized.startsWith('::ffff:127.');
}
