import * as tf from "@tensorflow/tfjs";
import { beforeAll, describe, expect, it } from "vitest";
import { accuracy, disposeModel, splitStratified, trainHead, type Sample } from "./index.ts";

// Dữ liệu tổng hợp: 3 cụm Gaussian trong không gian 256 chiều (giả lập embedding).
function synth(perClass: number, seed = 1): Sample[] {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296) - 0.5;
  const out: Sample[] = [];
  for (let label = 0; label < 3; label++)
    for (let i = 0; i < perClass; i++) {
      const v = new Float32Array(256);
      for (let d = 0; d < 256; d++) v[d] = rnd() * 0.5 + (d % 3 === label ? 1 : 0);
      out.push({ embedding: v, label });
    }
  return out;
}

describe("trainHead", () => {
  beforeAll(async () => {
    await tf.setBackend("cpu");
    await tf.ready();
  });

  it("learns separable clusters, no tensor leak, records history", async () => {
    const { train, test } = splitStratified(synth(30), 0.2);
    const before = tf.memory().numTensors;
    const r = await trainHead(train, { numClasses: 3, epochs: 15 });
    expect(r.history).toHaveLength(15);
    expect(r.history.at(-1)!.loss).toBeLessThan(r.history[0]!.loss);
    expect(accuracy(r.model, test)).toBeGreaterThanOrEqual(0.9);
    disposeModel(r.model);
    // Sau dispose model, số tensor quay về mức ban đầu (không rò rỉ dữ liệu huấn luyện).
    expect(tf.memory().numTensors).toBe(before);
  });

  it("splitStratified keeps every label in both sets", () => {
    const { train, test } = splitStratified(synth(10), 0.2);
    for (const l of [0, 1, 2]) {
      expect(train.some((x) => x.label === l)).toBe(true);
      expect(test.some((x) => x.label === l)).toBe(true);
    }
  });
});
