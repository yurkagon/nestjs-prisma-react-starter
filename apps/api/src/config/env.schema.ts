import ms, { type StringValue } from 'ms';
import { z } from 'zod';

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .optional()
    .transform((value) => Number(value?.trim() || 3000))
    .pipe(z.int().min(1).max(65535)),
  CLIENT_PORT: z
    .string()
    .optional()
    .transform((value) => Number(value?.trim() || 3001))
    .pipe(z.int().min(1).max(65535)),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  JWT_SECRET: z.string().regex(/\S/, 'Must not be blank'),
  JWT_EXPIRATION_TIME: z
    .string()
    .refine(
      (value) => value !== '' && ms(value as StringValue) >= 1000,
      'Expected a duration of at least 1 second (e.g. 2h or 7d)',
    ),
  JWT_REFRESH_EXPIRATION_TIME: z
    .string()
    .refine(
      (value) => value !== '' && ms(value as StringValue) >= 1000,
      'Expected a duration of at least 1 second (e.g. 2h or 7d)',
    ),
  CORS_ORIGIN: z
    .string()
    .trim()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean)
        : undefined,
    )
    .pipe(z.array(z.url({ protocol: /^https?$/ })).optional()),
  CLIENT_DIST_PATH: z.string().min(1).optional(),
});

export type Environment = z.infer<typeof environmentSchema>;
