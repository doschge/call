import { describe, it, expect } from 'vitest';
import { buildUrl } from '../src/core/url';

describe('buildUrl', () => {
    it('joint baseUrl (mit Trailing Slash) mit relativem Pfad korrekt', () => {
        const u = buildUrl('https://example.com/de/', 'users/1');
        expect(u.toString()).toBe('https://example.com/de/users/1');
    });

    it('joint baseUrl (ohne Trailing Slash) mit relativem Pfad korrekt', () => {
        const u = buildUrl('https://example.com/de', 'users/2');
        expect(u.toString()).toBe('https://example.com/de/users/2');
    });

    it('entfernt führende slash im Pfad', () => {
        const u = buildUrl('https://example.com/de/', '/users/3');
        expect(u.toString()).toBe('https://example.com/de/users/3');
    });

    it('hängt params an un ignoriert null/undefined', () => {
        const u = buildUrl('https://example.com/api/', 'items', {
            q: 'test',
            limit: 10,
            active: true,
            skip: null,
            none: undefined,
        });
        expect(u.toString()).toBe('https://example.com/api/items?q=test&limit=10&active=true');
    });

    it('merged bestehende Query in path mit params', () => {
        const u = buildUrl('https://example.com/api/', 'items?offset=20', { a: 1, b: 2 });
        expect(u.toString()).toBe('https://example.com/api/items?offset=20&a=1&b=2');
    });

    it('absolute URL bleibt erhalten; params werden angehängt', () => {
        const u = buildUrl(undefined, 'https://api.other.com/x', { a: 1, b: 2 });
        expect(u.toString()).toBe('https://api.other.com/x?a=1&b=2');
    });

    it('nutzt defaultOrigin, wenn baseUrl fehlt und Pfad relativ ist (Non-Browser)', () => {
        const u = buildUrl(undefined, 'users/1', undefined, 'https://env.example.com/api/');
        expect(u.toString()).toBe('https://env.example.com/api/users/1');
    });

    it('wirft Error bei relativem Pfad ohne baseUrl/defaultOrigin in Non-Browser-Umgebung', () => {
        expect(() => buildUrl(undefined, 'users/1')).toThrowError(
            'Relative URL provided but no baseUrl or defaultOrigin configured, and no window.location.origin available.'
        );
    });

    it('akzeptiert baseUrl als URL-Objekt', () => {
        const base = new URL('https://example.com/de'); // ohne Slash
        const u = buildUrl(base, 'x');
        expect(u.toString()).toBe('https://example.com/de/x');
    });
})