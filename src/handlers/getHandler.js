import { getConfig } from "../utils.js";
import { getRule, getRuleVersions } from "../operations/getRule.js";

export function handleGet(state, env, path) {
  console.log(`ConfigStorage: Handling GET request for path: ${path}`);

  // Ensure path is a string
  if (typeof path !== "string") {
    console.error(`Invalid path type: ${typeof path}`);
    return new Response(JSON.stringify({ error: "Invalid path" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (path === "/config") {
    return getConfig(state);
  } else if (path.startsWith("/rules/")) {
    const ruleId = path.split("/")[2];
    return getRule(state, ruleId);
  } else if (path.startsWith("/versions/")) {
    const ruleId = path.split("/")[2];
    return getRuleVersions(state, ruleId);
  }

  console.log(`ConfigStorage: GET request not found for path: ${path}`);
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
