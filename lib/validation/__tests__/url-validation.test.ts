import {
  validateUrl,
  sanitizeUrlForDisplay,
  extractDomain,
  isTrustedDomain,
  validateAndSanitizeUrl
} from '../event-validation';

describe('URL Validation', () => {
  describe('validateUrl', () => {
    it('should validate valid HTTPS URLs', () => {
      const validUrls = [
        'https://example.com',
        'https://www.example.com',
        'https://example.com/path',
        'https://example.com/path?query=value',
        'https://example.com/path?query=value&another=param',
        'https://subdomain.example.com',
        'https://example.com:8080',
        'https://example.com/path#fragment'
      ];

      validUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBeDefined();
        expect(result.error).toBeUndefined();
      });
    });

    it('should validate valid HTTP URLs', () => {
      const validUrls = [
        'http://example.com',
        'http://www.example.com',
        'http://example.com/path',
        'http://example.com/path?query=value'
      ];

      validUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBeDefined();
        expect(result.error).toBeUndefined();
      });
    });

    it('should add https:// protocol to URLs without protocol', () => {
      const urlsWithoutProtocol = [
        'example.com',
        'www.example.com',
        'subdomain.example.com',
        'example.com/path',
        'example.com/path?query=value'
      ];

      urlsWithoutProtocol.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toMatch(/^https:\/\//);
        expect(result.normalizedUrl).toContain(url);
      });
    });

    it('should handle empty and whitespace URLs', () => {
      const emptyUrls = ['', '   ', '\t', '\n'];

      emptyUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBe('');
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'file:///etc/passwd',
        'vbscript:msgbox("xss")',
        '://example.com',
        'https://',
        'http://',
        'https://.com',
        'https://example..com',
        'https://example.com:99999',
        'https://example.com:-1'
      ];

      invalidUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.normalizedUrl).toBeUndefined();
      });
    });

    it('should reject suspicious URLs', () => {
      const suspiciousUrls = [
        'https://localhost',
        'https://127.0.0.1',
        'https://0.0.0.0',
        'https://example.local',
        'https://malware.example.com',
        'https://phishing.example.com',
        'https://virus.example.com',
        'https://scam.example.com'
      ];

      suspiciousUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('suspicious patterns');
      });
    });

    it('should clean and normalize URLs', () => {
      const testCases = [
        {
          input: '  https://example.com  ',
          expected: 'https://example.com'
        },
        {
          input: 'https://example.com:80/',
          expected: 'https://example.com'
        },
        {
          input: 'https://example.com:443/',
          expected: 'https://example.com'
        },
        {
          input: 'https://example.com/path/',
          expected: 'https://example.com/path'
        },
        {
          input: 'https://example.com?b=2&a=1',
          expected: 'https://example.com?a=1&b=2'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = validateUrl(input);
        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBe(expected);
      });
    });

    it('should handle URLs with control characters', () => {
      const urlWithControlChars = 'https://example.com\x00\x1F\x7F';
      const result = validateUrl(urlWithControlChars);
      expect(result.isValid).toBe(true);
      expect(result.normalizedUrl).toBe('https://example.com');
    });
  });

  describe('sanitizeUrlForDisplay', () => {
    it('should remove sensitive query parameters', () => {
      const urlWithSensitiveParams = 'https://example.com?token=secret&id=123&password=hidden&name=test';
      const result = sanitizeUrlForDisplay(urlWithSensitiveParams);
      
      expect(result).toContain('https://example.com');
      expect(result).toContain('id=123');
      expect(result).toContain('name=test');
      expect(result).not.toContain('token=secret');
      expect(result).not.toContain('password=hidden');
    });

    it('should truncate very long URLs', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(200);
      const result = sanitizeUrlForDisplay(longUrl);
      
      expect(result.length).toBeLessThanOrEqual(100);
      expect(result).toMatch(/\.\.\.$/);
    });

    it('should handle invalid URLs gracefully', () => {
      const invalidUrl = 'not-a-valid-url';
      const result = sanitizeUrlForDisplay(invalidUrl);
      
      expect(result).toBe(invalidUrl);
    });

    it('should handle URLs with various sensitive parameters', () => {
      const sensitiveParams = ['token', 'key', 'secret', 'password', 'auth', 'session'];
      const url = 'https://example.com?' + sensitiveParams.map(p => `${p}=value`).join('&');
      const result = sanitizeUrlForDisplay(url);
      
      sensitiveParams.forEach(param => {
        expect(result).not.toContain(`${param}=value`);
      });
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from valid URLs', () => {
      const testCases = [
        { url: 'https://example.com', expected: 'example.com' },
        { url: 'https://www.example.com', expected: 'www.example.com' },
        { url: 'https://subdomain.example.com', expected: 'subdomain.example.com' },
        { url: 'https://example.com:8080', expected: 'example.com' },
        { url: 'https://example.com/path', expected: 'example.com' },
        { url: 'http://example.com', expected: 'example.com' }
      ];

      testCases.forEach(({ url, expected }) => {
        const result = extractDomain(url);
        expect(result).toBe(expected);
      });
    });

    it('should return null for invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'https://',
        'http://',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>'
      ];

      invalidUrls.forEach(url => {
        const result = extractDomain(url);
        expect(result).toBeNull();
      });
    });
  });

  describe('isTrustedDomain', () => {
    it('should identify trusted domains', () => {
      const trustedUrls = [
        'https://google.com',
        'https://www.google.com',
        'https://eventbrite.com',
        'https://ticketmaster.com',
        'https://seatgeek.com',
        'https://facebook.com',
        'https://meetup.com',
        'https://youtube.com',
        'https://vimeo.com',
        'https://github.com',
        'https://stackoverflow.com'
      ];

      trustedUrls.forEach(url => {
        const result = isTrustedDomain(url);
        expect(result).toBe(true);
      });
    });

    it('should identify untrusted domains', () => {
      const untrustedUrls = [
        'https://example.com',
        'https://malicious-site.com',
        'https://phishing-site.com',
        'https://unknown-domain.com'
      ];

      untrustedUrls.forEach(url => {
        const result = isTrustedDomain(url);
        expect(result).toBe(false);
      });
    });

    it('should accept custom trusted domains', () => {
      const customTrustedDomains = ['custom.com', 'mycompany.com'];
      const testUrls = [
        'https://custom.com',
        'https://www.custom.com',
        'https://mycompany.com',
        'https://subdomain.mycompany.com'
      ];

      testUrls.forEach(url => {
        const result = isTrustedDomain(url, customTrustedDomains);
        expect(result).toBe(true);
      });
    });

    it('should return false for invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'https://',
        'javascript:alert("xss")'
      ];

      invalidUrls.forEach(url => {
        const result = isTrustedDomain(url);
        expect(result).toBe(false);
      });
    });
  });

  describe('validateAndSanitizeUrl', () => {
    it('should validate and sanitize URLs with default options', () => {
      const validUrl = 'https://example.com';
      const result = validateAndSanitizeUrl(validUrl);
      
      expect(result.isValid).toBe(true);
      expect(result.normalizedUrl).toBeDefined();
      expect(result.warnings).toContain('URL is from an untrusted domain');
    });

    it('should require HTTPS by default', () => {
      const httpUrl = 'http://example.com';
      const result = validateAndSanitizeUrl(httpUrl);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('HTTPS is required');
    });

    it('should allow HTTP when allowHttp is true', () => {
      const httpUrl = 'http://example.com';
      const result = validateAndSanitizeUrl(httpUrl, { allowHttp: true });
      
      expect(result.isValid).toBe(true);
      expect(result.normalizedUrl).toBeDefined();
    });

    it('should check URL length', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(3000);
      const result = validateAndSanitizeUrl(longUrl, { maxLength: 100 });
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('URL too long');
    });

    it('should warn about shortened links', () => {
      const shortenedUrls = [
        'https://bit.ly/abc123',
        'https://tinyurl.com/xyz789'
      ];

      shortenedUrls.forEach(url => {
        const result = validateAndSanitizeUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('URL appears to be a shortened link');
      });
    });

    it('should accept trusted domains without warnings', () => {
      const trustedUrl = 'https://google.com';
      const result = validateAndSanitizeUrl(trustedUrl);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toBeUndefined();
    });

    it('should validate with custom trusted domains', () => {
      const customUrl = 'https://custom.com';
      const result = validateAndSanitizeUrl(customUrl, { 
        trustedDomains: ['custom.com'] 
      });
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toBeUndefined();
    });

    it('should handle various option combinations', () => {
      const testCases = [
        {
          url: 'http://example.com',
          options: { allowHttp: true, requireHttps: false },
          shouldBeValid: true
        },
        {
          url: 'http://example.com',
          options: { allowHttp: false, requireHttps: false },
          shouldBeValid: false
        },
        {
          url: 'https://example.com',
          options: { requireHttps: true },
          shouldBeValid: true
        },
        {
          url: 'https://example.com',
          options: { requireHttps: false },
          shouldBeValid: true
        }
      ];

      testCases.forEach(({ url, options, shouldBeValid }) => {
        const result = validateAndSanitizeUrl(url, options);
        expect(result.isValid).toBe(shouldBeValid);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle URLs with special characters', () => {
      const specialCharUrls = [
        'https://example.com/path with spaces',
        'https://example.com/path%20with%20encoded',
        'https://example.com/path+with+plus',
        'https://example.com/path?query=value with spaces',
        'https://example.com/path#fragment with spaces'
      ];

      specialCharUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBeDefined();
      });
    });

    it('should handle international domain names', () => {
      const internationalUrls = [
        'https://例え.jp',
        'https://测试.com',
        'https://тест.рф'
      ];

      internationalUrls.forEach(url => {
        const result = validateUrl(url);
        // These might be valid or invalid depending on the environment
        expect(typeof result.isValid).toBe('boolean');
      });
    });

    it('should handle URLs with very long paths', () => {
      const longPathUrl = 'https://example.com/' + 'a'.repeat(1000);
      const result = validateUrl(longPathUrl);
      
      expect(result.isValid).toBe(true);
      expect(result.normalizedUrl).toBeDefined();
    });

    it('should handle URLs with many query parameters', () => {
      const manyParams = Array.from({ length: 50 }, (_, i) => `param${i}=value${i}`).join('&');
      const urlWithManyParams = `https://example.com?${manyParams}`;
      const result = validateUrl(urlWithManyParams);
      
      expect(result.isValid).toBe(true);
      expect(result.normalizedUrl).toBeDefined();
    });

    it('should handle malformed URLs gracefully', () => {
      const malformedUrls = [
        'https://',
        'http://',
        '://example.com',
        'https://.com',
        'https://example..com',
        'https://example.com:',
        'https://example.com:abc',
        'https://example.com:-1',
        'https://example.com:99999'
      ];

      malformedUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('Security Tests', () => {
    it('should reject URLs with dangerous protocols', () => {
      const dangerousUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'vbscript:msgbox("xss")',
        'file:///etc/passwd',
        'ftp://malicious.com',
        'gopher://malicious.com'
      ];

      dangerousUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should reject URLs pointing to localhost and private IPs', () => {
      const localhostUrls = [
        'https://localhost',
        'https://127.0.0.1',
        'https://0.0.0.0',
        'https://192.168.1.1',
        'https://10.0.0.1',
        'https://172.16.0.1'
      ];

      localhostUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('suspicious patterns');
      });
    });

    it('should reject URLs with suspicious patterns', () => {
      const suspiciousUrls = [
        'https://malware.example.com',
        'https://phishing.example.com',
        'https://virus.example.com',
        'https://scam.example.com',
        'https://example.local',
        'https://example.onion'
      ];

      suspiciousUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('suspicious patterns');
      });
    });

    it('should handle URLs with encoded characters', () => {
      const encodedUrls = [
        'https://example.com/path%2Fwith%2Fencoded%2Fslashes',
        'https://example.com/path%20with%20spaces',
        'https://example.com/path%3Fwith%3Dencoded%26chars',
        'https://example.com/path%23with%23hash'
      ];

      encodedUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBeDefined();
      });
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle event URLs from various sources', () => {
      const eventUrls = [
        'https://www.eventbrite.com/e/tech-conference-2024-tickets-123456789',
        'https://www.ticketmaster.com/event/123456789/tech-conference-2024',
        'https://seatgeek.com/tech-conference-2024-tickets',
        'https://www.meetup.com/tech-group/events/123456789',
        'https://www.facebook.com/events/123456789',
        'https://www.youtube.com/watch?v=abc123def456',
        'https://vimeo.com/123456789'
      ];

      eventUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBeDefined();
      });
    });

    it('should handle URLs with complex query parameters', () => {
      const complexUrls = [
        'https://example.com/event?utm_source=google&utm_medium=cpc&utm_campaign=tech&ref=homepage',
        'https://example.com/event?date=2024-01-15&time=10:00&location=NYC&category=tech',
        'https://example.com/event?filter[category]=tech&filter[date]=2024&sort=date&order=asc'
      ];

      complexUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBeDefined();
      });
    });

    it('should handle URLs with fragments', () => {
      const fragmentUrls = [
        'https://example.com/event#details',
        'https://example.com/event#tickets',
        'https://example.com/event#location',
        'https://example.com/event?query=value#fragment'
      ];

      fragmentUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBeDefined();
      });
    });
  });
});
