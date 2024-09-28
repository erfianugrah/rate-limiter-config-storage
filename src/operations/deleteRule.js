import { pushConfigUpdate, safeStringify } from "../utils.js";

/**
 * Deletes a rule from the config storage.
 * @param {DurableObjectState} state - The Durable Object state.
 * @param {Object} env - The environment object containing configuration.
 * @param {string} ruleId - The ID of the rule to delete.
 * @returns {Promise<Response>} A response indicating success or failure.
 */
export async function deleteRule(state, env, ruleId) {
  try {
    console.log(`ConfigStorage: Deleting rule with ID: ${ruleId}`);
    let rules = await state.storage.get("rules");
    console.log("Current rules before delete:", safeStringify(rules));

    if (typeof rules === "string") {
      rules = JSON.parse(rules);
    }

    const index = rules.findIndex((r) => r.id === ruleId);
    if (index === -1) {
      console.log(`ConfigStorage: Rule not found for ID: ${ruleId}`);
      return new Response(JSON.stringify({ error: "Rule not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const deletedRule = rules.splice(index, 1)[0];
    console.log("Deleted rule:", safeStringify(deletedRule));
    console.log("Rules after delete:", safeStringify(rules));

    await state.storage.put("rules", JSON.stringify(rules));
    console.log("Updated rules saved to storage");

    await state.storage.delete(`versions_${ruleId}`);
    console.log(`Versions for rule ${ruleId} deleted`);

    await pushConfigUpdate(state, env);

    return new Response(
      JSON.stringify({ message: "Rule deleted", deletedRule }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("ConfigStorage: Error deleting rule:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to delete rule",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
