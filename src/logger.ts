import { pino, type Logger } from "pino";

// Chemins masqués dans tous les logs : sessions, jetons et données personnelles.
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "*.password",
  "*.token",
  "*.email",
  "*.phone",
  "*.whatsapp",
  "req.body",
];

export function createLogger(level: string, pretty = false): Logger {
  return pino({
    level,
    redact: { paths: REDACT_PATHS, censor: "[masqué]" },
    ...(pretty ? { transport: { target: "pino-pretty", options: { colorize: true } } } : {}),
  });
}
