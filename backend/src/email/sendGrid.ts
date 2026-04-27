import sgMail from "@sendgrid/mail";
import type { AppConfig } from "../config";
import type { AlertRecord, ProductRecord } from "../types";

export async function sendPriceDropEmail(alert: AlertRecord, product: ProductRecord, appConfig: AppConfig) {
  if (!appConfig.sendgridApiKey || !appConfig.sendgridFromEmail) {
    if (appConfig.demoFallback) {
      console.log(
        `[alerts] Demo email skipped for ${alert.email}: ${product.name} is ${product.currency} ${product.currentPrice}`
      );
      return false;
    }
    throw new Error("SendGrid is not configured.");
  }

  sgMail.setApiKey(appConfig.sendgridApiKey);
  await sgMail.send({
    to: alert.email,
    from: appConfig.sendgridFromEmail,
    subject: `TrueCost alert: ${product.name} dropped to ${product.currency} ${product.currentPrice}`,
    text: `Good news. ${product.name} is now ${product.currency} ${product.currentPrice}, at or below your target of ${alert.currency} ${alert.targetPrice}.\n\nView product: ${product.url}`,
    html: `<p>Good news. <strong>${product.name}</strong> is now <strong>${product.currency} ${product.currentPrice}</strong>, at or below your target of ${alert.currency} ${alert.targetPrice}.</p><p><a href="${product.url}">View product</a></p>`
  });
  return true;
}
