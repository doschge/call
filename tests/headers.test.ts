import { describe, it, expect, vi } from 'vitest';
import { createCall } from '../src';

function okResponse(body = 'ok', headers: Record<string, string> = { 'Content-Type': 'text/plain' }) {
    return new Response(body, { status: 200, headers });
}

describe('Header-Merging & Content-Type', () => {
    it('merged config.headers und opts.headers; opts überschreibt config', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okResponse());

        const call = createCall({
            fetch: fetchMock,
            headers: {
                Authorization: 'Bearer AAA',
                Accept: 'application/json',
            }
        });

        await call.get('https://api.test/merge', {
            headers: {
                Accept: 'text/plain',
                'X-Id': '1',
            },
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [, init] = fetchMock.mock.calls[0];
        const hdrs = new Headers(init!.headers as HeadersInit);

        expect(hdrs.get('authorization')).toBe('Bearer AAA');
        expect(hdrs.get('accept')).toBe('text/plain');
        expect(hdrs.get('x-id')).toBe('1');
    });

    it('setzt Content-Type automatisch auf application/json, wenn json verwendet wird', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okResponse(JSON.stringify({ ok: true }), { 'Content-Type': 'application/json' }));
        const call = createCall({ fetch: fetchMock });

        await call.post('https://api.test/json', { json: { a: 1 } });

        const [, init] = fetchMock.mock.calls[0];
        const hdrs = new Headers(init!.headers as HeadersInit);

        expect(hdrs.get('content-type')).toBe('application/json');
        expect(init!.body).toBe(JSON.stringify({ a: 1 }));
    });

    it('default überschreibt Content-Type NICHT, wenn bereits gesetzt ist', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okResponse());
        const call = createCall({ fetch: fetchMock });

        await call.post('https://api.test/custom-json', {
            json: { a: 1 },
            headers: { 'Content-Type': 'application/vnd.custom+json' },
        });

        const [, init] = fetchMock.mock.calls[0];
        const hdrs = new Headers(init!.headers as HeadersInit);

        expect(hdrs.get('content-type')).toBe('application/vnd.custom+json');
    });

    it('setzt Content-Type nicht automatisch bei body/FormData', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okResponse());
        const call = createCall({ fetch: fetchMock });

        const fd = new FormData();
        fd.set('file', new Blob(['x']), 'x.txt');

        await call.post('https://api.test/upload', { body: fd });

        const [, init] = fetchMock.mock.calls[0];
        const hdrs = new Headers(init!.headers as HeadersInit);

        expect(hdrs.get('content-type')).toBeNull();
        expect(init!.body).toBe(fd);
    })
})