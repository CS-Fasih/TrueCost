import { config } from "./config";
import { createApp } from "./app";
import { createStore } from "./db";

async function bootstrap() {
  const store = createStore(config);
  await store.ready();
  const { app } = createApp({ appConfig: config, store });
  const server = app.listen(config.port, () => {
    console.log(`TrueCost API listening on ${config.port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await store.close();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
