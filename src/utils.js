export async function getConfig(state) {
  try {
    console.log("ConfigStorage: Getting config");
    let rules = await state.storage.get("rules");
    console.log("Raw rules from storage:", safeStringify(rules));

    if (rules === null || rules === undefined || rules === "") {
      console.log("No rules found in storage, initializing empty array");
      rules = "[]";
    } else if (typeof rules !== "string") {
      console.log("Rules in storage is not a string, stringifying");
      rules = JSON.stringify(rules);
    }

    const parsedRules = JSON.parse(rules);
    console.log("Parsed rules:", safeStringify(parsedRules));

    return new Response(JSON.stringify({ rules: parsedRules }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ConfigStorage: Error retrieving rules:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to retrieve rules",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function pushConfigUpdate(state, env) {
  try {
    console.log("Pushing config update...");
    if (!state) {
      console.error("Invalid state object:", state);
      throw new Error("Invalid state object");
    }

    let config;
    if (state.storage) {
      config = await getConfig(state);
    } else if (state.CONFIG_STORAGE) {
      const configStorageId = state.CONFIG_STORAGE.idFromName("global");
      const configStorage = state.CONFIG_STORAGE.get(configStorageId);
      const response = await configStorage.fetch("/config");
      config = await response.json();
    } else {
      throw new Error("Unable to retrieve config");
    }

    if (!env || !env.CONFIG_QUEUE) {
      console.error("Invalid env object or missing CONFIG_QUEUE:", env);
      throw new Error("Invalid env object or missing CONFIG_QUEUE");
    }
    await env.CONFIG_QUEUE.send({
      type: "config_update",
      version: config.version || Date.now(), // Use current timestamp if version is not available
    });
    console.log("Config update notification pushed to queue");
  } catch (error) {
    console.error("Error pushing config update notification:", error);
    // We're logging the error but not throwing it to prevent breaking the main flow
  }
}

export function isValidRuleStructure(rule) {
  const isValid = rule &&
    typeof rule === "object" &&
    typeof rule.id === "string" &&
    typeof rule.name === "string" &&
    typeof rule.description === "string" &&
    typeof rule.rateLimit === "object" &&
    typeof rule.rateLimit.limit === "number" &&
    typeof rule.rateLimit.period === "number" &&
    typeof rule.fingerprint === "object" &&
    Array.isArray(rule.fingerprint.parameters) &&
    typeof rule.initialMatch === "object" &&
    Array.isArray(rule.initialMatch.conditions) &&
    typeof rule.initialMatch.action === "object" &&
    Array.isArray(rule.elseIfActions) &&
    (!rule.elseAction || typeof rule.elseAction === "object");

  console.log(`Rule structure validation result: ${isValid}`);
  if (!isValid) {
    console.log("Invalid rule structure:", safeStringify(rule));
  }

  return isValid;
}

export function areValidRules(rules) {
  const isValid = Array.isArray(rules) &&
    rules.every((rule) => isValidRuleStructure(rule));
  console.log(`Rules array validation result: ${isValid}`);
  return isValid;
}

export function safeStringify(obj, indent = 2) {
  let cache = [];
  const retVal = JSON.stringify(
    obj,
    (key, value) =>
      typeof value === "object" && value !== null
        ? cache.includes(value)
          ? undefined // Duplicate reference found, discard key
          : cache.push(value) && value // Store value in our collection
        : value,
    indent,
  );
  cache = null;
  return retVal;
}
