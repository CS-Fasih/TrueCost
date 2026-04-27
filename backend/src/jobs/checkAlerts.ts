import { config } from "../config";
import { createStore } from "../db";
import { sendPriceDropEmail } from "../email/sendGrid";
import { Analyzer } from "../services/analyzer";
import { shouldTriggerAlert } from "../services/alerts";

async function checkAlerts() {
  const store = createStore(config);
  await store.ready();
  const analyzer = new Analyzer(store, config);
  const alerts = await store.listActiveAlerts();
  console.log(`[alerts] Checking ${alerts.length} active alert${alerts.length === 1 ? "" : "s"}.`);

  for (const alert of alerts) {
    try {
      const bundle = await store.getProductBundle(alert.productId);
      if (!bundle) continue;
      const analysis = await analyzer.analyze(bundle.product.url);
      if (!shouldTriggerAlert(analysis.product.currentPrice, alert.targetPrice)) continue;
      await sendPriceDropEmail(alert, analysis.product, config);
      await store.markAlertTriggered(alert.id);
      console.log(`[alerts] Triggered alert ${alert.id} for ${alert.email}.`);
    } catch (error) {
      console.error(`[alerts] Failed alert ${alert.id}`, error);
    }
  }

  await store.close();
}

checkAlerts().catch((error) => {
  console.error(error);
  process.exit(1);
});
