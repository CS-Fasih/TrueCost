import sgMail from "@sendgrid/mail";
import nodemailer from "nodemailer";
import type { AppConfig } from "../config";
import type { AlertRecord, ProductRecord } from "../types";

export async function sendPriceDropEmail(alert: AlertRecord, product: ProductRecord, appConfig: AppConfig) {
  const subject = `TrueCost alert: ${product.name} dropped to ${product.currency} ${product.currentPrice}`;
  const text = `Good news. ${product.name} is now ${product.currency} ${product.currentPrice}, at or below your target of ${alert.currency} ${alert.targetPrice}.\n\nView product: ${product.url}`;
  const html = `<p>Good news. <strong>${product.name}</strong> is now <strong>${product.currency} ${product.currentPrice}</strong>, at or below your target of ${alert.currency} ${alert.targetPrice}.</p><p><a href="${product.url}">View product</a></p>`;

  if (appConfig.sendgridApiKey && appConfig.sendgridFromEmail) {
    sgMail.setApiKey(appConfig.sendgridApiKey);
    await sgMail.send({
      to: alert.email,
      from: appConfig.sendgridFromEmail,
      subject,
      text,
      html
    });
    return true;
  }

  if (appConfig.smtpHost && appConfig.smtpUser && appConfig.smtpPass && appConfig.smtpFromEmail) {
    const transport = nodemailer.createTransport({
      host: appConfig.smtpHost,
      port: appConfig.smtpPort,
      secure: appConfig.smtpPort === 465,
      auth: {
        user: appConfig.smtpUser,
        pass: appConfig.smtpPass
      }
    });

    await transport.sendMail({
      to: alert.email,
      from: appConfig.smtpFromEmail,
      subject,
      text,
      html
    });
    return true;
  }

  if (appConfig.demoFallback) {
    console.log(`[alerts] Email skipped for ${alert.email}: no SendGrid or SMTP sender is configured.`);
    return false;
  }

  throw new Error("No email sender is configured. Set SendGrid or SMTP config vars.");
}
