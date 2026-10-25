import { after } from "next/server";

export function afterResponse(job: () => Promise<unknown>) {
  const run = () => Promise.resolve(job()).catch((error) => console.error("background", error));
  try {
    after(run);
  } catch {
    void run();
  }
}
