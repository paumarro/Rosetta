import { describe, it, expect } from 'vitest';
import { parseCookies } from '../../src/utils/cookieParser.js';

describe('Cookie Parser', () => {
  describe('basic parsing', () => {
    it('should parse a single cookie', () => {
      expect(parseCookies('name=value')).toEqual({ name: 'value' });
    });

    it('should parse multiple cookies', () => {
      expect(parseCookies('name1=value1; name2=value2')).toEqual({
        name1: 'value1',
        name2: 'value2',
      });
    });

    it('should handle empty and undefined input', () => {
      expect(parseCookies('')).toEqual({});
      expect(parseCookies(undefined)).toEqual({});
    });
  });

  describe('JWT token handling', () => {
    it('should handle JWT tokens with equals signs in value', () => {
      const jwtToken = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature==';
      expect(parseCookies(`id_token=${jwtToken}`)).toEqual({ id_token: jwtToken });
    });

    it('should handle realistic Microsoft id_token cookie', () => {
      const microsoftToken =
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IjJaUXBKM1VwYmpBWVhZR2FYRUpsOGxWMFRPSSJ9.' +
        'eyJhdWQiOiIxMjM0NTY3OC1hYmNkLWVmMDEtMjM0NS02Nzg5MGFiY2RlZjAifQ.' +
        'signature';

      const result = parseCookies(
        `id_token=${microsoftToken}; access_token=other; refresh_token=refresh`,
      );

      expect(result.id_token).toBe(microsoftToken);
      expect(result.access_token).toBe('other');
    });
  });

  describe('URL encoding', () => {
    it('should decode URL-encoded special characters', () => {
      expect(parseCookies('email=user%40example.com')).toEqual({
        email: 'user@example.com',
      });
    });
  });

  describe('edge cases', () => {
    it('should ignore malformed cookie entries without names', () => {
      expect(parseCookies('=value; name=test')).toEqual({ name: 'test' });
    });

    it('should handle cookie names with hyphens and underscores', () => {
      expect(parseCookies('my-cookie=value1; my_cookie=value2')).toEqual({
        'my-cookie': 'value1',
        my_cookie: 'value2',
      });
    });

    it('should not execute or parse JSON in cookie values', () => {
      const jsonValue = '{"key":"value"}';
      const result = parseCookies(`data=${encodeURIComponent(jsonValue)}`);
      expect(result.data).toBe(jsonValue);
    });
  });
});
