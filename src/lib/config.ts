import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(1),
  TZ: z.string().default("Asia/Seoul"),
  STORAGE_DIR: z.string().default(".storage"),
  USE_AI_MOCK: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
  CHATBOT_API_URL: z.string().optional(),
  CHATBOT_SERVICE_TOKEN: z.string().optional(),
  INTERVIEW_API_URL: z.string().optional(),
  INTERVIEW_SERVICE_TOKEN: z.string().optional(),
  ALLOW_SEED: z.string().optional(),
  SEED_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missingKeys = parsed.error.issues.map((issue) => issue.path.join("."));
  throw new Error(`Environment validation failed for keys: ${missingKeys.join(", ")}`);
}

export const env = parsed.data;
