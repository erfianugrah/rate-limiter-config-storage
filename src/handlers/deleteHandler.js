import { deleteRule } from "../operations/deleteRule.js";

export function handleDelete(state, env, path) {
  console.log(`ConfigStorage: Handling DELETE request for path: ${path}`);
  if (path.startsWith("/rules/")) {
    const ruleId = path.split("/")[2];
    console.log(`ConfigStorage: Deleting rule with ID: ${ruleId}`);
    return deleteRule(state, env, ruleId);
  }
  console.log(`ConfigStorage: DELETE request not found for path: ${path}`);
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
