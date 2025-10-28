import { describe, it, expect, vi } from 'vitest';
import { createCall } from '../src';

describe('Parsing-Varianten', () => {
    function okResponse(body: BodyInit, headers: Record<string, string>) {
        return new Response(body, { status: 200, headers });
    }

    it('Default-Parsing: text bei Content-Type text/plain', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            okResponse('hello', { 'Content-Type': 'text/plain' })
        );
        const call = createCall({ fetch: fetchMock });
        const data = await call.get<string>('https://api.test/text')

        expect(data.content).toBe('hello');
    });

    it('parseAs: text', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            okResponse('hi', { 'Content-Type': 'application/octet-stream' })
        );

        const call = createCall({ fetch: fetchMock });
        const data = await call.get<string>('https://api.test/text', { parseAs: 'text' });

        expect(data.content).toBe('hi');
    });

    it('parseAs: blob', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            okResponse('blob-data', { 'Content-Type': 'application/octet-stream' })
        );

        const call = createCall({ fetch: fetchMock });
        const blob = await call.get<Blob>('https://api.test/blob', { parseAs: 'blob' });

        expect(blob.content).toBeInstanceOf(Blob);
        const text = await blob.content!.text();
        expect(text).toBe('blob-data');
    });

    it('parseAs: arrayBuffer', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            okResponse('abc', {'Content-Type': 'application/octet-stream'})
        );

        const call = createCall({fetch: fetchMock});
        const ab = await call.get<ArrayBuffer>('https://api.test/ab', {parseAs: 'arrayBuffer'});

        expect(ab.content).toBeInstanceOf(ArrayBuffer);
        expect(new TextDecoder().decode(new Uint8Array(ab.content!))).toBe('abc');
    });

    it('parseAs: response gibt die Response zurück', async () => {
        const res = new Response('x', { status: 200, headers: { 'Content-Type': 'text/plain' }});
        const fetchMock = vi.fn().mockResolvedValue(res);

        const call = createCall({ fetch: fetchMock });
        const out = await call.get<Response>('https://api.test/resp', { parseAs: 'response' });
        expect(out.content).toBe(res);
    });

    it('parseAs: steam gibt ReadableStream zurück', async () => {
        const res = new Response('stream-data', { status: 200, headers: { 'Content-Type': 'text/plain' }});
        const fetchMock = vi.fn().mockResolvedValue(res);

        const call = createCall({ fetch: fetchMock });
        const stream = await call.get<ReadableStream<Uint8Array | null>>('https://api.test/stream', { parseAs: 'stream' });
        expect(stream.content).toBe(res.body);
    });

    it('wirft CallError bei ungültigem JSON (Response parse error', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            okResponse('invalid-json', { 'Content-Type': 'application/json' })
        );

        const call = createCall({ fetch: fetchMock });

        await expect(call.get('http://api.test/bad-json')).rejects.toMatchObject({
            name: 'CallError',
            message: 'Response parse error',
        });
    });
})