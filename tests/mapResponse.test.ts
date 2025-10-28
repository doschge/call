import { describe, it, expect, vi } from 'vitest';
import { createCall } from '../src';

describe('mapResponse', () => {
    it('transformiert die geparsten Daten', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ value: 21 }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const call = createCall({ fetch: fetchMock });
        const res = await call.get<number>('https://api.test/map', {
            mapResponse: (data: any) => data.value * 2,
        });

        expect(res.content).toBe(42);
    })
})