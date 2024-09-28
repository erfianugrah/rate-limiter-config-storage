import { reorderRules } from "../operations/reorderRule.js";
import { revertRule } from "../operations/revertRule.js";
import { updateRule } from "../operations/updateRule.js";

export async function handlePut(state, env, request, path) {
  console.log(`ConfigStorage: Handling PUT request for path: ${path}`);
  if (path === "/config/reorder") {
    console.log("ConfigStorage: Reordering rules");
    const { rules } = await request.json();
    return reorderRules(state, env, rules);
  } else if (path.startsWith("/rules/")) {
    const parts = path.split("/");
    const ruleId = parts[2];
    if (parts[3] === "revert") {
      console.log(`ConfigStorage: Reverting rule with ID: ${ruleId}`);
      const { targetVersion } = await request.json();
      return revertRule(state, env, ruleId, targetVersion);
    } else {
      console.log(`ConfigStorage: Updating rule with ID: ${ruleId}`);
      const rule = await request.json();
      return updateRule(state, env, ruleId, rule);
    }
  }
  console.log(`ConfigStorage: PUT request not found for path: ${path}`);
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
