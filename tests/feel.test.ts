// Titreşim: Capacitor eklentisi bir Proxy'dir; Promise'ten döndürülürse ".then" çağrılır ve
// Android'de "Haptics.then() is not implemented" hatasıyla oyun çöker (v0.1.21). Bu test o hatayı yakalar.
import { test, expect, vi } from "vitest";

const calls: string[] = [];
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true } }));
vi.mock("@capacitor/haptics", () => ({
  Haptics: new Proxy({}, {
    get(_t, prop) {
      if (prop === "then") return () => { throw new Error('"Haptics.then()" is not implemented on android'); };
      return (o: unknown) => { calls.push(`${String(prop)}:${JSON.stringify(o)}`); return Promise.resolve(); };
    },
  }),
}));

test("titreşim Capacitor eklentisiyle çökmeden çalışır", async () => {
  const errors: unknown[] = [];
  const onErr = (e: unknown) => errors.push(e);
  process.on("unhandledRejection", onErr);
  const { buzz } = await import("../src/ui/feel");
  buzz("medium"); buzz("long");
  await new Promise(r => setTimeout(r, 50));
  buzz("light");
  await new Promise(r => setTimeout(r, 20));
  process.off("unhandledRejection", onErr);
  expect(errors).toEqual([]);
  expect(calls).toEqual(['impact:{"style":"MEDIUM"}', 'vibrate:{"duration":250}', 'impact:{"style":"LIGHT"}']);
});
