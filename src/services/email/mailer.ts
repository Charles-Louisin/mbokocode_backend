import type { Logger } from "pino";
import { Resend } from "resend";
import type { AppConfig } from "../../config/env.js";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Même clé = même email : Resend n'envoie pas deux fois (nouvelle tentative, webhook rejoué). */
  idempotencyKey: string;
};

export type SendResult = { status: "sent" | "failed" | "skipped"; attempts: number };

export type Mailer = {
  /** Vrai si Resend est configuré (clé + expéditeur). */
  readonly enabled: boolean;
  /** Destinataire des notifications internes, s'il est configuré. */
  readonly adminEmail: string | undefined;
  send(message: EmailMessage): Promise<SendResult>;
};

const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 2;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

/** Destinataire des notifications : ADMIN_NOTIFICATION_EMAIL, sinon la première adresse valide d'ADMIN_EMAILS. */
export function notificationRecipient(config: Pick<AppConfig, "ADMIN_NOTIFICATION_EMAIL" | "ADMIN_EMAILS">): string | undefined {
  if (config.ADMIN_NOTIFICATION_EMAIL) return config.ADMIN_NOTIFICATION_EMAIL;
  return config.ADMIN_EMAILS?.split(",")
    .map((value) => value.trim())
    .find((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

/**
 * Envoi via Resend : délai maximal, une seule nouvelle tentative, clé d'idempotence.
 * Les logs ne contiennent ni destinataire ni contenu, seulement la clé et le statut.
 */
export function createResendMailer(config: AppConfig, logger: Logger): Mailer {
  const enabled = Boolean(config.RESEND_API_KEY && config.EMAIL_FROM);
  const client = enabled ? new Resend(config.RESEND_API_KEY) : null;

  return {
    enabled,
    adminEmail: notificationRecipient(config),
    async send(message) {
      if (!client || !config.EMAIL_FROM) {
        logger.info({ key: message.idempotencyKey }, "email non envoyé : Resend non configuré");
        return { status: "skipped", attempts: 0 };
      }
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const { error } = await withTimeout(
            client.emails.send(
              {
                from: config.EMAIL_FROM,
                to: message.to,
                subject: message.subject,
                html: message.html,
                text: message.text,
                ...(message.replyTo ? { replyTo: message.replyTo } : {}),
              },
              { idempotencyKey: message.idempotencyKey },
            ),
            TIMEOUT_MS,
          );
          if (!error) return { status: "sent", attempts: attempt };
          logger.warn({ key: message.idempotencyKey, attempt, code: error.name }, "email refusé par Resend");
        } catch (err) {
          logger.warn({ key: message.idempotencyKey, attempt, reason: (err as Error).message }, "échec d'envoi email");
        }
        if (attempt < MAX_ATTEMPTS) await wait(600);
      }
      return { status: "failed", attempts: MAX_ATTEMPTS };
    },
  };
}

/** Échappe le texte saisi par l'utilisateur avant de l'insérer dans un email HTML. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
