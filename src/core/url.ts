function ensureTrailingSlash(base: string | URL): URL {
    const u = typeof base === 'string' ? new URL(base) : new URL(base.toString());
    if (!u.pathname.endsWith('/')) u.pathname += '/';
    return u;
}

function isAbsoluteUrl(input: string): boolean {
    try {
        new URL(input);
        return true;
    } catch {
        return false;
    }
}

export function buildUrl(
    baseUrl: string | URL | undefined,
    path: string,
    params?: Record<string, string | number | boolean | null | undefined>,
    defaultOrigin?: string | URL,
): URL {
    if (isAbsoluteUrl(path)) {
        const url = new URL(path);
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
            }
        }
        return url;
    }

    const isBrowser = typeof window !== 'undefined' && (window as any).location;
    const origin =
        baseUrl ??
        defaultOrigin ??
        (isBrowser ? (window as any).location.origin : undefined);

    if (!origin) {
        throw new Error('Relative URL provided but no baseUrl or defaultOrigin configured, and no window.location.origin available.');
    }

    const base = ensureTrailingSlash(origin);
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;

    const url = new URL(cleanPath, base);

    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
        }
    }

    return url;
}