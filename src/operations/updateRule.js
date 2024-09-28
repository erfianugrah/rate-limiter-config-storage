import {
  isValidRuleStructure,
  pushConfigUpdate,
  safeStringify,
} from "../utils.js";

export async function updateRule(state, env, ruleId, updatedRule) {
  try {
    console.log(`ConfigStorage: Updating rule with ID: ${ruleId}`);
    console.log("Received updated rule:", safeStringify(updatedRule));

    let rules = await state.storage.get("rules");
    console.log("Current rules from storage (raw):", rules);
    console.log("Current rules before update:", safeStringify(rules));

    if (typeof rules === "string") {
      rules = JSON.parse(rules);
    }

    console.log("Parsed current rules:", safeStringify(rules));

    const index = rules.findIndex((r) => r.id === ruleId);
    if (index !== -1) {
      if (!isValidRuleStructure(updatedRule)) {
        console.log("Invalid rule structure received");
        throw new Error("Invalid rule structure");
      }
      const oldRule = rules[index];
      console.log("Old rule:", safeStringify(oldRule));

      const newVersion = oldRule.version + 1;

      const newRule = {
        ...oldRule,
        ...updatedRule,
        id: oldRule.id,
        order: oldRule.order,
        version: newVersion,
        rateLimit: { ...oldRule.rateLimit, ...updatedRule.rateLimit },
        fingerprint: {
          parameters: [
            ...(updatedRule.fingerprint?.parameters ||
              oldRule.fingerprint.parameters),
          ],
        },
        initialMatch: {
          ...oldRule.initialMatch,
          ...updatedRule.initialMatch,
          conditions: [
            ...(updatedRule.initialMatch?.conditions ||
              oldRule.initialMatch.conditions),
          ],
          action: {
            ...oldRule.initialMatch.action,
            ...updatedRule.initialMatch?.action,
          },
        },
        elseIfActions: [
          ...(updatedRule.elseIfActions || oldRule.elseIfActions),
        ],
        elseAction: updatedRule.elseAction || oldRule.elseAction,
      };

      console.log("New rule after merging:", safeStringify(newRule));

      rules[index] = newRule;

      console.log("Updated rules array:", safeStringify(rules));

      const stringifiedRules = JSON.stringify(rules);
      console.log("Stringified rules to be stored:", stringifiedRules);

      await state.storage.put("rules", stringifiedRules);
      console.log("Rules saved to storage");

      // Verify that the rules were saved correctly
      const savedRules = await state.storage.get("rules");
      console.log("Saved rules (raw):", savedRules);
      console.log(
        "Saved rules (parsed):",
        safeStringify(JSON.parse(savedRules)),
      );

      let versions = JSON.parse(
        (await state.storage.get(`versions_${ruleId}`)) || "[]",
      );
      console.log("Current versions:", safeStringify(versions));

      versions.push({
        version: newVersion,
        timestamp: new Date().toISOString(),
        changes: ["Rule updated"],
        data: JSON.parse(JSON.stringify(newRule)),
      });

      if (versions.length > env.VERSION_LIMIT) {
        console.log(
          `Removing oldest version. Current count: ${versions.length}, Limit: ${env.VERSION_LIMIT}`,
        );
        versions.shift(); // Remove the oldest version
      }

      const stringifiedVersions = JSON.stringify(versions);
      console.log("Stringified versions to be stored:", stringifiedVersions);

      await state.storage.put(`versions_${ruleId}`, stringifiedVersions);
      console.log("Versions saved to storage");

      // Verify that the versions were saved correctly
      const savedVersions = await state.storage.get(
        `versions_${ruleId}`,
      );
      console.log("Saved versions (raw):", savedVersions);
      console.log(
        "Saved versions (parsed):",
        safeStringify(JSON.parse(savedVersions)),
      );

      console.log("Rule update complete");

      await pushConfigUpdate(state, env);

      return new Response(
        JSON.stringify({ message: "Rule updated", rule: newRule }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    console.log(`ConfigStorage: Rule not found for ID: ${ruleId}`);
    return new Response(JSON.stringify({ error: "Rule not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ConfigStorage: Error updating rule:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to update rule",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
