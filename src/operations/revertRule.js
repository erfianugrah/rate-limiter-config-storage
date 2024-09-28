import { pushConfigUpdate, safeStringify } from "../utils.js";

/**
 * Reverts a rule to a specified version.
 * @param {DurableObjectState} state - The Durable Object state.
 * @param {Object} env - The environment object containing configuration.
 * @param {string} ruleId - The ID of the rule to revert.
 * @param {number} targetVersion - The version to revert to.
 * @returns {Promise<Response>} A response indicating success or failure.
 */
export async function revertRule(state, env, ruleId, targetVersion) {
  try {
    console.log(
      `ConfigStorage: Reverting rule ${ruleId} to version ${targetVersion}`,
    );
    let rules = await state.storage.get("rules");
    console.log("Current rules before revert:", safeStringify(rules));

    if (typeof rules === "string") {
      rules = JSON.parse(rules);
    }

    const ruleIndex = rules.findIndex((r) => r.id === ruleId);
    if (ruleIndex === -1) {
      console.log(`Rule not found for ID: ${ruleId}`);
      return new Response(JSON.stringify({ error: "Rule not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const currentRule = rules[ruleIndex];
    console.log("Current rule:", safeStringify(currentRule));

    const versions = JSON.parse(
      (await state.storage.get(`versions_${ruleId}`)) || "[]",
    );
    console.log("All versions for the rule:", safeStringify(versions));

    const targetVersionData = versions.find((v) => v.version === targetVersion);

    if (!targetVersionData) {
      console.log(`Target version ${targetVersion} not found in history`);
      return new Response(
        JSON.stringify({ error: "Target version not found in history" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      "Target version data:",
      safeStringify(targetVersionData),
    );

    const revertedRule = {
      ...targetVersionData.data,
      version: currentRule.version + 1,
      order: currentRule.order,
    };
    console.log("Reverted rule:", safeStringify(revertedRule));

    rules[ruleIndex] = revertedRule;
    console.log("Updated rules array:", safeStringify(rules));

    await state.storage.put("rules", JSON.stringify(rules));
    console.log("Updated rules saved to storage");

    versions.push({
      version: revertedRule.version,
      timestamp: new Date().toISOString(),
      changes: [`Reverted to version ${targetVersion}`],
      data: JSON.parse(JSON.stringify(revertedRule)),
    });

    if (versions.length > env.VERSION_LIMIT) {
      console.log(
        `Removing oldest version. Current count: ${versions.length}, Limit: ${env.VERSION_LIMIT}`,
      );
      versions.shift(); // Remove the oldest version
    }

    console.log("Updated versions array:", safeStringify(versions));

    await state.storage.put(
      `versions_${ruleId}`,
      JSON.stringify(versions),
    );
    console.log("Updated versions saved to storage");

    await pushConfigUpdate(state, env);

    return new Response(
      JSON.stringify({ message: "Rule reverted", rule: revertedRule }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("ConfigStorage: Error reverting rule:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to revert rule",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
