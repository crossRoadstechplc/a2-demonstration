import { ApiError, api } from "./api";

export type DemoScenarioName =
  | "morning-operations"
  | "station-congestion"
  | "charger-fault"
  | "refrigerated-priority-load";

async function safePost(path: string) {
  try {
    const { data } = await api.post(path, {});
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new Error("Demo endpoint is not available on this backend.");
    }
    throw error;
  }
}

export const demoService = {
  reset: async () => safePost("/demo/reset"),
  seed: async () => safePost("/demo/seed"),
  triggerScenario: async (name: DemoScenarioName) =>
    safePost(`/demo/scenario/${name}`),
};
