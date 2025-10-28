import { describe, it, expect, vi } from 'vitest';
import { createCall } from '../src';

describe('createCall (minimal)', () => {
    it('parst JSON automatisch anhand des Content-Type', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ hello: 'world' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const call = createCall({ fetch: fetchMock });
        const data = await call.get<{ hello: string }>('https://api.test/hello');

        expect(data.content).toEqual({ hello: 'world' });
        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.test/hello',
            expect.objectContaining({ method: 'GET' })
        )
    });

    it('wirft CallError bei HTTP-Fehlern und enthält Status + Payload', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ error: 'Bad request' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const call = createCall({ fetch: fetchMock });

        await expect(call.get('https://api.test/bad')).rejects.toMatchObject({
            name: 'CallError',
            status: 400,
            data: { error: 'Bad request' },
        })
    })
})