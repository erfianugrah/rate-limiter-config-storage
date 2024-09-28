import { safeStringify } from "../utils.js";

export async function getRule(state, ruleId) {
  try {
    console.log(`ConfigStorage: Getting rule with ID: ${ruleId}`);
    const rules = JSON.parse((await state.storage.get("rules")) || "[]");
    console.log("All rules:", safeStringify(rules));

    const rule = rules.find((r) => r.id === ruleId);
    if (rule) {
      console.log(`ConfigStorage: Rule found:`, safeStringify(rule));
      return new Response(JSON.stringify(rule), {
        headers: { "Content-Type": "application/json" },
      });
    }
    console.log(`ConfigStorage: Rule not found for ID: ${ruleId}`);
    return new Response(JSON.stringify({ error: "Rule not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ConfigStorage: Error retrieving rule:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to retrieve rule",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function getRuleVersions(state, ruleId) {
  try {
    console.log(
      `ConfigStorage: Getting versions for rule with ID: ${ruleId}`,
    );
    const versions = JSON.parse(
      (await state.storage.get(`versions_${ruleId}`)) || "[]",
    );
    console.log(`Versions for rule ${ruleId}:`, safeStringify(versions));

    if (versions.length > 0) {
      return new Response(JSON.stringify({ versions }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    console.log(`ConfigStorage: No versions found for rule ID: ${ruleId}`);
    return new Response(JSON.stringify({ error: "No versions found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ConfigStorage: Error retrieving rule versions:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to retrieve rule versions",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
