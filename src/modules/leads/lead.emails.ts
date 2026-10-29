import { escapeHtml, type EmailMessage } from "../../services/email/mailer.js";
import { BUDGETS, DEADLINES, FEATURES, SERVICE_TYPES } from "./lead.options.js";

type LeadForEmail = {
  publicRef: string;
  name: string;
  email: string;
  whatsapp?: string | null;
  company?: string | null;
  website?: string | null;
  serviceType: string;
  goal: string;
  features: string[];
  constraints?: string | null;
  budget?: string | null;
  deadline?: string | null;
};

const label = <T extends Record<string, string>>(map: T, key?: string | null) => (key && key in map ? map[key as keyof T] : undefined);

function rows(lead: LeadForEmail): [string, string][] {
  const items: [string, string | undefined][] = [
    ["Référence", lead.publicRef],
    ["Projet", label(SERVICE_TYPES, lead.serviceType)],
    ["Fonctionnalités", lead.features.map((f) => label(FEATURES, f)).filter(Boolean).join(", ") || undefined],
    ["Budget indicatif", label(BUDGETS, lead.budget)],
    ["Échéance", label(DEADLINES, lead.deadline)],
  ];
  return items.filter((row): row is [string, string] => Boolean(row[1]));
}

function layout(title: string, intro: string, table: [string, string][], blocks: [string, string][]): string {
  const tr = table
    .map(([k, v]) => `<tr><td style="padding:6px 16px 6px 0;color:#6b7590">${escapeHtml(k)}</td><td style="padding:6px 0">${escapeHtml(v)}</td></tr>`)
    .join("");
  const extra = blocks
    .map(([k, v]) => `<p style="margin:20px 0 6px;color:#6b7590">${escapeHtml(k)}</p><p style="margin:0;white-space:pre-wrap">${escapeHtml(v)}</p>`)
    .join("");
  return `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#0b1326;max-width:560px">
<h1 style="font-size:22px;margin:0 0 12px">${escapeHtml(title)}</h1>
<p style="margin:0 0 20px">${escapeHtml(intro)}</p>
<table style="border-collapse:collapse;font-size:15px">${tr}</table>${extra}
<p style="margin:28px 0 0;color:#6b7590;font-size:13px">MBOKO CODE — Charles Louisin Yimbne</p></div>`;
}

function text(title: string, intro: string, table: [string, string][], blocks: [string, string][]): string {
  return [title, "", intro, "", ...table.map(([k, v]) => `${k} : ${v}`), ...blocks.flatMap(([k, v]) => ["", `${k} :`, v]), "", "MBOKO CODE — Charles Louisin Yimbne"].join(
    "\n",
  );
}

/** Accusé de réception envoyé au prospect. */
export function confirmationEmail(lead: LeadForEmail): EmailMessage {
  const firstName = lead.name.split(/\s+/)[0] ?? lead.name;
  const title = `Demande bien reçue, ${firstName}`;
  const intro =
    "Merci pour ton message. Je lis chaque demande personnellement et je reviens vers toi par e-mail. Garde cette référence : elle me permet de retrouver ton dossier.";
  const table = rows(lead);
  const blocks: [string, string][] = [["Ton projet", lead.goal]];
  return {
    to: lead.email,
    subject: `MBOKO CODE — demande ${lead.publicRef} reçue`,
    html: layout(title, intro, table, blocks),
    text: text(title, intro, table, blocks),
    idempotencyKey: `lead-confirmation/${lead.publicRef}`,
  };
}

/** Notification interne à Charles, avec les coordonnées pour répondre. */
export function notificationEmail(lead: LeadForEmail, adminEmail: string): EmailMessage {
  const title = `Nouvelle demande : ${label(SERVICE_TYPES, lead.serviceType) ?? lead.serviceType}`;
  const intro = `${lead.name}${lead.company ? ` (${lead.company})` : ""} vient d'envoyer une demande depuis le portfolio.`;
  const table: [string, string][] = [
    ...rows(lead),
    ["E-mail", lead.email],
    ...(lead.whatsapp ? ([["WhatsApp", `+${lead.whatsapp}`]] as [string, string][]) : []),
    ...(lead.website ? ([["Site", lead.website]] as [string, string][]) : []),
  ];
  const blocks: [string, string][] = [["Objectif", lead.goal], ...(lead.constraints ? ([["Contraintes", lead.constraints]] as [string, string][]) : [])];
  return {
    to: adminEmail,
    replyTo: lead.email,
    subject: `[Portfolio] ${lead.publicRef} — ${lead.name}`,
    html: layout(title, intro, table, blocks),
    text: text(title, intro, table, blocks),
    idempotencyKey: `lead-notification/${lead.publicRef}`,
  };
}
