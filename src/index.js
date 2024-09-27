export { ConfigStorage } from "./config-storage.js";

export default {
  async fetch(request, env) {
    const configStorageId = env.CONFIG_STORAGE.idFromName("global");
    const configStorage = env.CONFIG_STORAGE.get(configStorageId);

    // Here you might want to add authentication and authorization checks
    // before allowing access to the ConfigStorage

    return configStorage.fetch(request);
  },
};
