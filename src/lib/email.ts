import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const from = process.env.EMAIL_FROM ?? "Hostly <onboarding@resend.dev>";

export async function sendTransactionalEmail(input: { to: string; subject: string; html: string }) {
  if (!resend) throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
  const result = await resend.emails.send({ from, to: input.to, subject: input.subject, html: input.html });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}