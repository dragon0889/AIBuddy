import * as tf from "@tensorflow/tfjs";
import type { Sample } from "./dataset.ts";

export interface TrainOptions {
  numClasses: number;
  /** "Số lần học tập" (epochs) trong UI trẻ em. */
  epochs?: number;
  /** "Kích thước nhóm mẫu" (batch size). */
  batchSize?: number;
  learningRate?: number;
  /** Gọi sau mỗi lần học để vẽ biểu đồ Accuracy/Loss thời gian thực (FR-005). */
  onEpoch?: (e: { epoch: number; loss: number; accuracy: number }) => void;
}

export interface TrainResult {
  model: tf.LayersModel;
  history: Array<{ loss: number; accuracy: number }>;
  trainMs: number;
}

export function buildHead(inputDim: number, numClasses: number, learningRate = 0.01): tf.Sequential {
  const m = tf.sequential();
  m.add(tf.layers.dense({ inputShape: [inputDim], units: 32, activation: "relu" }));
  m.add(tf.layers.dense({ units: numClasses, activation: "softmax" }));
  m.compile({ optimizer: tf.train.adam(learningRate), loss: "categoricalCrossentropy", metrics: ["accuracy"] });
  return m;
}

/** Huấn luyện đầu phân loại nhỏ trên embedding đã trích xuất (transfer learning). */
export async function trainHead(samples: Sample[], opts: TrainOptions): Promise<TrainResult> {
  if (samples.length === 0) throw new Error("No samples");
  const dim = samples[0]!.embedding.length;
  const model = buildHead(dim, opts.numClasses, opts.learningRate);
  const xs = tf.tensor2d(samples.map((s) => Array.from(s.embedding)));
  // tidy: tensor1d trung gian sẽ bị rò rỉ nếu không bọc (đã bắt được bằng test rò rỉ tensor).
  const ys = tf.tidy(() => tf.oneHot(tf.tensor1d(samples.map((s) => s.label), "int32"), opts.numClasses));
  const history: TrainResult["history"] = [];
  const t0 = performance.now();
  try {
    await model.fit(xs, ys, {
      epochs: opts.epochs ?? 20,
      batchSize: opts.batchSize ?? 16,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          const row = { loss: Number(logs?.loss ?? 0), accuracy: Number(logs?.acc ?? logs?.accuracy ?? 0) };
          history.push(row);
          opts.onEpoch?.({ epoch, ...row });
        },
      },
    });
  } finally {
    xs.dispose();
    ys.dispose();
  }
  return { model, history, trainMs: performance.now() - t0 };
}

export function predict(model: tf.LayersModel, embedding: Float32Array): { label: number; confidence: number; probs: number[] } {
  const probs = tf.tidy(() => (model.predict(tf.tensor2d([Array.from(embedding)])) as tf.Tensor).dataSync());
  const arr = Array.from(probs);
  let best = 0;
  arr.forEach((p, i) => { if (p > arr[best]!) best = i; });
  return { label: best, confidence: arr[best]!, probs: arr };
}

export function accuracy(model: tf.LayersModel, samples: Sample[]): number {
  if (samples.length === 0) return 0;
  return samples.filter((s) => predict(model, s.embedding).label === s.label).length / samples.length;
}

/** Giải phóng mô hình và cả trạng thái optimizer (Adam giữ các biến riêng; `model.dispose()` không xóa chúng). */
export function disposeModel(model: tf.LayersModel): void {
  (model.optimizer as { dispose?: () => void } | undefined)?.dispose?.();
  model.dispose();
}
