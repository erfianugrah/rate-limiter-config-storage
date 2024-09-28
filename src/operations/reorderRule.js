import { areValidRules, pushConfigUpdate, safeStringify } from "../utils.js";

/**
 * Reorders the rules based on the provided updated rules array.
 * @param {DurableObjectState} state - The Durable Object state.
 * @param {Object} env - The environment object containing configuration.
 * @param {Array} updatedRules - The array of rules with updated order.
 * @returns {Promise<Response>} A response indicating success or failure.
 */
export async function reorderRules(state, env, updatedRules) {
  try {
    console.log(
      "ConfigStorage: Reordering rules, received:",
      safeStringify(updatedRules),
    );
    if (!Array.isArray(updatedRules)) {
      throw new Error("Invalid input: updatedRules must be an array");
    }
    if (!areValidRules(updatedRules)) {
      throw new Error("Invalid rule structure in the updated rules");
    }

    // Check for duplicate or missing rule IDs
    const currentRules = JSON.parse(await state.storage.get("rules") || "[]");
    const currentIds = new Set(currentRules.map((rule) => rule.id));
    const updatedIds = new Set(updatedRules.map((rule) => rule.id));

    if (
      currentIds.size !== updatedIds.size ||
      ![...currentIds].every((id) => updatedIds.has(id))
    ) {
      throw new Error(
        "The updated rules must contain all and only the existing rule IDs",
      );
    }

    const reorderedRules = updatedRules.map((rule, index) => ({
      ...rule,
      order: index,
    }));

    console.log("Reordered rules:", safeStringify(reorderedRules));

    await state.storage.put("rules", JSON.stringify(reorderedRules));
    console.log("Reordered rules saved to storage");

    await pushConfigUpdate(state, env);

    return new Response(
      JSON.stringify({ message: "Rules reordered", rules: reorderedRules }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("ConfigStorage: Error reordering rules:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to reorder rules",
        details: error.message,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
