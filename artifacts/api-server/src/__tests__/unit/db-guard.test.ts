import { describe, it, expect } from 'vitest';
import { hasSqlInjectionPattern, sanitizeStringParam, assertNoRawSqlFromUserInput } from '../../lib/db-guard.js';

describe('hasSqlInjectionPattern', () => {
  it('stringa sicura → false', () => {
    expect(hasSqlInjectionPattern('Mario Rossi')).toBe(false);
    expect(hasSqlInjectionPattern('mario@northstar.app')).toBe(false);
    expect(hasSqlInjectionPattern('Software Engineer @ Acme')).toBe(false);
  });

  it('quote singola → true (classic injection)', () => {
    expect(hasSqlInjectionPattern("' OR '1'='1")).toBe(true);
  });

  it('UNION SELECT → true', () => {
    expect(hasSqlInjectionPattern('UNION SELECT * FROM users')).toBe(true);
    expect(hasSqlInjectionPattern('union select password from users')).toBe(true);
  });

  it('commento SQL -- → true', () => {
    expect(hasSqlInjectionPattern("admin'--")).toBe(true);
  });

  it('punto e virgola (statement terminator) → true', () => {
    expect(hasSqlInjectionPattern('foo; DROP TABLE users;')).toBe(true);
  });

  it('WAITFOR DELAY (time-based blind) → true', () => {
    expect(hasSqlInjectionPattern('WAITFOR DELAY 0:0:5')).toBe(true);
  });

  it('hex encoding → true', () => {
    expect(hasSqlInjectionPattern('0x41424344')).toBe(true);
  });

  it('DROP TABLE → true', () => {
    expect(hasSqlInjectionPattern('DROP TABLE users')).toBe(true);
  });
});

describe('sanitizeStringParam', () => {
  it('rimuove caratteri di controllo', () => {
    const dirty = 'hello\x00world\x1F';
    expect(sanitizeStringParam(dirty)).toBe('helloworld');
  });

  it('taglia spazi iniziali e finali', () => {
    expect(sanitizeStringParam('  hello  ')).toBe('hello');
  });

  it('preserva caratteri Unicode normali', () => {
    expect(sanitizeStringParam('Ciao 🌟 mondo')).toBe('Ciao 🌟 mondo');
  });
});

describe('assertNoRawSqlFromUserInput', () => {
  it('query pulita → non lancia', () => {
    expect(() => assertNoRawSqlFromUserInput('SELECT * FROM users WHERE id = $1', 'test')).not.toThrow();
  });

  it('query con interpolazione diretta → lancia errore', () => {
    expect(() =>
      assertNoRawSqlFromUserInput("SELECT * FROM users WHERE email = 'mario@test.com' OR '1'='1'", 'test'),
    ).toThrow('[db-guard]');
  });

  it('UNION injection → lancia errore', () => {
    expect(() =>
      assertNoRawSqlFromUserInput('SELECT id FROM users UNION SELECT password FROM users', 'test'),
    ).toThrow('[db-guard]');
  });
});
