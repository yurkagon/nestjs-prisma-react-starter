import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { environmentSchema, type Environment } from './env.schema';

const valid = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/nestjs_starter',
  REDIS_URL: 'redis://localhost:6380',
  JWT_SECRET: 'test-secret',
  JWT_EXPIRATION_TIME: '2h',
  JWT_REFRESH_EXPIRATION_TIME: '7d',
};

const configFor = (values: Record<string, unknown>) =>
  new ConfigService<Environment>(environmentSchema.parse(values));

describe('environment configuration', () => {
  const original = process.env;

  afterEach(() => {
    process.env = original;
  });

  it('preserves the default ports', () => {
    const config = configFor(valid);
    expect(config.get('NODE_ENV')).toBe('development');
    expect(config.get('PORT')).toBe(3000);
    expect(config.get('CLIENT_PORT')).toBe(3001);
  });

  it('uses default ports and leaves CORS unset for blank settings', () => {
    const config = configFor({ ...valid, PORT: '   ', CLIENT_PORT: '', CORS_ORIGIN: '  ' });
    expect(config.get('PORT')).toBe(3000);
    expect(config.get('CLIENT_PORT')).toBe(3001);
    expect(config.get('CORS_ORIGIN')).toBeUndefined();
  });

  it('parses configured ports', () => {
    expect(environmentSchema.parse({ ...valid, PORT: '3012', CLIENT_PORT: '4001' })).toMatchObject({
      PORT: 3012,
      CLIENT_PORT: 4001,
    });
  });

  it('trims configured origins and drops empty entries', () => {
    const config = configFor({
      ...valid,
      CORS_ORIGIN: 'https://a.example, https://b.example ,,',
      CLIENT_DIST_PATH: '/srv/client/dist',
    });
    expect(config.get('CORS_ORIGIN')).toEqual(['https://a.example', 'https://b.example']);
    expect(config.get('CLIENT_DIST_PATH')).toBe('/srv/client/dist');
  });

  it.each(['PORT', 'CLIENT_PORT'])('rejects invalid %s values', (name) => {
    for (const value of ['0', '65536', '-1', '3012.5', 'abc']) {
      expect(() => environmentSchema.parse({ ...valid, [name]: value })).toThrow(name);
    }
  });

  it.each(Object.keys(valid))('requires %s', (name) => {
    expect(() => environmentSchema.parse({ ...valid, [name]: undefined })).toThrow(name);
    expect(() => environmentSchema.parse({ ...valid, [name]: '  ' })).toThrow(name);
  });

  it.each([
    ['DATABASE_URL', 'https://example.com'],
    ['REDIS_URL', 'postgresql://localhost/db'],
    ['NODE_ENV', 'typo'],
    ['CORS_ORIGIN', 'not-an-origin'],
    ['CLIENT_DIST_PATH', ''],
  ])('rejects invalid %s', (name, value) => {
    expect(() => environmentSchema.parse({ ...valid, [name]: value })).toThrow(name);
  });

  it.each(['JWT_EXPIRATION_TIME', 'JWT_REFRESH_EXPIRATION_TIME'])(
    'rejects invalid or expired durations in %s',
    (name) => {
      for (const value of ['', 'invalid', '0', '-1h', '500ms', 'x'.repeat(100), '1'.repeat(101)]) {
        expect(() => environmentSchema.parse({ ...valid, [name]: value })).toThrow(name);
      }
    },
  );

  it('accepts TLS Redis, PostgreSQL options and ms-compatible durations', () => {
    expect(
      environmentSchema.parse({
        ...valid,
        DATABASE_URL: 'postgres://user:password@localhost/db?sslmode=require',
        REDIS_URL: 'rediss://user:password@redis.example:6380/1',
        JWT_SECRET: ' secret with spaces ',
        JWT_EXPIRATION_TIME: '30 minutes',
        JWT_REFRESH_EXPIRATION_TIME: '604800000',
      }),
    ).toMatchObject({
      JWT_SECRET: ' secret with spaces ',
      JWT_EXPIRATION_TIME: '30 minutes',
      JWT_REFRESH_EXPIRATION_TIME: '604800000',
    });
  });

  it('reports invalid keys without exposing their values', () => {
    let message = '';
    try {
      environmentSchema.parse({
        ...valid,
        DATABASE_URL: 'invalid://user:private-password@localhost/db',
        JWT_EXPIRATION_TIME: 'private-value',
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('JWT_EXPIRATION_TIME');
    expect(message).not.toContain('private-password');
    expect(message).not.toContain('private-value');
  });

  it('exposes parsed values through the injected ConfigService', async () => {
    process.env = {
      ...original,
      ...valid,
      PORT: '3012',
      CORS_ORIGIN: 'https://example.com',
      UNVALIDATED_SETTING: 'hidden',
    };
    const { ConfigModule: ApplicationConfigModule } = await import('./config.module');
    const module = await Test.createTestingModule({
      imports: [ApplicationConfigModule],
    }).compile();

    try {
      const config = module.get(ConfigService<Environment>);
      expect(config.getOrThrow('PORT', { infer: true })).toBe(3012);
      expect(config.get('CORS_ORIGIN')).toEqual(['https://example.com']);
      expect(module.get(ConfigService).get<unknown>('UNVALIDATED_SETTING')).toBeUndefined();
    } finally {
      await module.close();
    }
  });

  it('loads a single env file and preserves shell overrides', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'api-env-'));
    process.env = { PORT: '3020' };

    try {
      const root = join(directory, '.env');
      writeFileSync(
        root,
        Object.entries({
          ...valid,
          PORT: '3000',
          CLIENT_PORT: '4001',
          CORS_ORIGIN: 'https://example.com',
        })
          .map(([key, value]) => `${key}=${value}`)
          .join('\n'),
      );

      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            envFilePath: root,
            expandVariables: true,
            skipProcessEnv: true,
            validate: (values) => environmentSchema.parse(values),
          }),
        ],
      }).compile();

      try {
        const config = module.get(ConfigService<Environment>);
        expect(config.getOrThrow('PORT', { infer: true })).toBe(3020);
        expect(config.getOrThrow('CLIENT_PORT', { infer: true })).toBe(4001);
        expect(config.get('CORS_ORIGIN')).toEqual(['https://example.com']);
        expect(config.getOrThrow('JWT_SECRET', { infer: true })).toBe(valid.JWT_SECRET);
      } finally {
        await module.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
