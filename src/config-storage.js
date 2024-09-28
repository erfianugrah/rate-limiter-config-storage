import { handleGet } from "./handlers/getHandler.js";
import { handlePost } from "./handlers/postHandler.js";
import { handlePut } from "./handlers/putHandler.js";
import { handleDelete } from "./handlers/deleteHandler.js";

const VERSION_LIMIT = 20;

const createLogger = (prefix) => (message) =>
  console.log(`${prefix}: ${message}`);

const handleRequest = (state, env) => async (request) => {
  const logger = createLogger("ConfigStorage");
  const url = new URL(request.url);
  const path = url.pathname;

  logger(`Received ${request.method} request for path: ${path}`);

  const handlers = {
    GET: () => handleGet(state, env, path),
    POST: () => handlePost(state, env, request),
    PUT: () => handlePut(state, env, request, path),
    DELETE: () => handleDelete(state, env, path),
  };

  const handler = handlers[request.method] ||
    (() =>
      new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      }));

  try {
    return await handler();
  } catch (error) {
    logger(`Error handling request: ${error}`);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

const measureExecutionTime = (fn) => async (...args) => {
  const startTime = Date.now();
  const result = await fn(...args);
  const endTime = Date.now();
  console.log(
    `ConfigStorage: fetch took ${endTime - startTime}ms for ${args[0].url}`,
  );
  return result;
};

export class ConfigStorage {
  constructor(state, env) {
    this.fetch = measureExecutionTime(handleRequest(state, env));
    console.log(
      `ConfigStorage: Initialized with VERSION_LIMIT: ${VERSION_LIMIT}`,
    );
  }
}
