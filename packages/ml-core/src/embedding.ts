import * as tf from "@tensorflow/tfjs";

/** MobileNet v1 α=0.25 (Keras layers model, Apache-2.0), tự host tại /models/mobilenet_v1_025/. */
export const MOBILENET_URL = "/models/mobilenet_v1_025/model.json";
export const EMBEDDING_DIM = 256;
const FEATURE_LAYER = "conv_pw_13_relu";

export type FrameSource = HTMLCanvasElement | HTMLVideoElement | ImageData | OffscreenCanvas;

export interface Embedder {
  /** Trả vector đặc trưng (256 chiều). Mọi tensor trung gian được giải phóng. */
  embed(frame: FrameSource): Promise<Float32Array>;
  /** Giải phóng mô hình nền. */
  dispose(): void;
}

export async function loadEmbedder(url: string = MOBILENET_URL): Promise<Embedder> {
  const base = await tf.loadLayersModel(url);
  const trunk = tf.model({ inputs: base.inputs, outputs: base.getLayer(FEATURE_LAYER).output });
  return {
    async embed(frame) {
      const out = tf.tidy(() => {
        const px = tf.browser.fromPixels(frame as never);
        const resized = tf.image.resizeBilinear(px, [224, 224]);
        const norm = resized.toFloat().div(127.5).sub(1).expandDims(0);
        const feat = trunk.predict(norm) as tf.Tensor4D; // [1,7,7,256]
        return feat.mean([1, 2]).squeeze() as tf.Tensor1D; // [256]
      });
      const data = (await out.data()) as Float32Array;
      out.dispose();
      return data;
    },
    dispose() {
      // `trunk` dùng chung layer với `base`: chỉ giải phóng một lần (gọi cả hai sẽ lỗi "already disposed").
      base.dispose();
    },
  };
}
