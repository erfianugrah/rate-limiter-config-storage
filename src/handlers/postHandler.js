import {
  isValidRuleStructure,
  pushConfigUpdate,
  safeStringify,
} from "../utils.js";

/**
 * Handles POST requests to add a new rule.
 * @param {DurableObjectState} state - The Durable Object state.
 * @param {Object} env - The environment object containing configuration.
 * @param {Request} request - The incoming request object.
 * @returns {Promise<Response>} A response indicating success or failure.
 */
export async function handlePost(state, env, request) {
  try {
    console.log("ConfigStorage: Handling POST request");
    const rule = await request.json();
    console.log("Received rule:", safeStringify(rule));

    if (!isValidRuleStructure(rule)) {
      console.log("Invalid rule structure received");
      throw new Error("Invalid rule structure");
    }

    let rules = await state.storage.get("rules");
    console.log("Current rules from storage:", safeStringify(rules));

    if (rules === null || rules === undefined || rules === "") {
      rules = [];
    } else if (typeof rules === "string") {
      rules = JSON.parse(rules);
    }

    console.log("Parsed rules from storage:", safeStringify(rules));

    rule.version = 0;
    rule.order = rules.length;
    rules.push(rule);

    console.log("Updated rules array:", safeStringify(rules));

    await state.storage.put("rules", JSON.stringify(rules));
    console.log("Rules saved to storage");

    const versions = [
      {
        version: 0,
        timestamp: new Date().toISOString(),
        changes: ["Initial version"],
        data: JSON.parse(JSON.stringify(rule)),
      },
    ];
    console.log(
      `Versions for new rule ${rule.id}:`,
      safeStringify(versions),
    );

    await state.storage.put(
      `versions_${rule.id}`,
      JSON.stringify(versions),
    );
    console.log(`Versions saved for rule ${rule.id}`);

    await pushConfigUpdate(state, env);

    return new Response(JSON.stringify(rule), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ConfigStorage: Error adding rule:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to add rule",
        details: error.message,
      }),
      {
        status: error.message === "Invalid rule structure" ? 400 : 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
