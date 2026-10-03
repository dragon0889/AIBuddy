"use client";
import { useEffect, useRef, useState } from "react";

type SpriteState = { x: number; y: number; log: string[] };

declare global {
  interface Window {
    __blocksSpike?: {
      ready: boolean;
      customBlockTypes: string[];
      loadProgram: (program: unknown) => void;
      /** Mô phỏng mô hình nhận diện ra nhãn `label` → chạy các chồng khối "khi nhận diện là …". */
      classify: (label: string) => SpriteState;
      reset: () => void;
    };
  }
}

const LABELS: [string, string][] = [["Bàn tay mở", "open"], ["Nắm tay", "fist"], ["Khác", "other"]];

export default function BlocksSpike() {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<SpriteState>({ x: 0, y: 0, log: [] });

  useEffect(() => {
    let disposed = false;
    let ws: import("blockly/core").WorkspaceSvg | undefined;
    (async () => {
      const SB = await import("scratch-blocks");
      if (disposed || !host.current) return;
      const Blockly = SB as unknown as typeof import("blockly/core");
      
      // --- Khối ML tùy chỉnh (FR-006 "Custom ML Extensions") ---
      Blockly.Blocks["ml_whenclassified"] = {
        init(this: import("blockly/core").Block) {
          this.jsonInit({
            message0: "khi mô hình nhận ra %1",
            args0: [{ type: "field_dropdown", name: "LABEL", options: LABELS }],
            extensions: ["colours_sensing", "shape_hat"],
          });
        },
      };
      Blockly.Blocks["ml_isclass"] = {
        init(this: import("blockly/core").Block) {
          this.jsonInit({
            message0: "mô hình nhận ra %1 ?",
            args0: [{ type: "field_dropdown", name: "LABEL", options: LABELS }],
            extensions: ["colours_sensing", "output_boolean"],
          });
        },
      };
      Blockly.Blocks["ml_confidence"] = {
        init(this: import("blockly/core").Block) {
          this.jsonInit({ message0: "độ chắc chắn của mô hình", extensions: ["colours_sensing", "output_number"] });
        },
      };

      // scratch-blocks 2.x không kèm theme màu: host phải cung cấp (ở Scratch GUI là "color mode"). Bảng màu Scratch 3.
      const style = (p: string, s: string, t: string) => ({ colourPrimary: p, colourSecondary: s, colourTertiary: t });
      const theme = Blockly.Theme.defineTheme("aibuddy", {
        name: "aibuddy",
        blockStyles: {
          motion: style("#4C97FF", "#4280D7", "#3373CC"),
          looks: style("#9966FF", "#855CD6", "#774DCB"),
          sounds: style("#CF63CF", "#C94FC9", "#BD42BD"),
          event: style("#FFBF00", "#E6AC00", "#CC9900"),
          control: style("#FFAB19", "#EC9C13", "#CF8B17"),
          sensing: style("#5CB1D6", "#47A8D1", "#2E8EB8"),
          operators: style("#59C059", "#46B946", "#389438"),
          data: style("#FF8C1A", "#FF8000", "#DB6E00"),
          data_lists: style("#FF661A", "#FF5500", "#E64D00"),
          more: style("#FF6680", "#FF4D6A", "#FF3355"),
          pen: style("#0FBD8C", "#0DA57A", "#0B8E69"),
          textField: style("#FFFFFF", "#FFFFFF", "#C9C9C9"),
        },
      } as never);

      // Chuỗi thông điệp Scratch (bắt buộc, nếu thiếu: lỗi "args0 must have a corresponding message"). Thử tiếng Việt, lùi về tiếng Anh.
      try { SB.ScratchMsgs.setLocale("vi"); } catch { SB.ScratchMsgs.setLocale("en"); }

      ws = SB.inject(host.current, {
        theme,
        media: "/blockly-media/",
        // Tự host media: mặc định Blockly gọi blockly-demo.appspot.com (rò rỉ tới bên thứ ba).
        toolbox: {
          kind: "categoryToolbox",
          contents: [
            {
              kind: "category",
              name: "Mô hình AI",
              categoryStyle: undefined,
              colour: "#5CB1D6",
              secondaryColour: "#47A8D1",
              contents: [
                { kind: "block", type: "ml_whenclassified" },
                { kind: "block", type: "ml_isclass" },
                { kind: "block", type: "ml_confidence" },
              ],
            },
            {
              kind: "category",
              name: "Chuyển động",
              colour: "#4C97FF",
              secondaryColour: "#3373CC",
              contents: [
                { kind: "block", type: "motion_movesteps", inputs: { STEPS: { shadow: { type: "math_number", fields: { NUM: 10 } } } } },
              ],
            },
          ],
        },
        scrollbars: true,
        sounds: false,
      } as never);

      const sprite: SpriteState = { x: 0, y: 0, log: [] };
      const num = (b: import("blockly/core").Block | null, input: string) => Number(b?.getInputTargetBlock(input)?.getFieldValue("NUM") ?? 0);

      // Trình thông dịch tối thiểu: duyệt chồng khối từ hat. (Không dùng scratch-vm do giấy phép AGPL – xem báo cáo.)
      const run = (label: string): SpriteState => {
        for (const top of ws!.getTopBlocks(true)) {
          if (top.type !== "ml_whenclassified" || top.getFieldValue("LABEL") !== label) continue;
          for (let b = top.getNextBlock(); b; b = b.getNextBlock()) {
            if (b.type === "motion_movesteps") { sprite.x += num(b, "STEPS"); sprite.log.push(`move ${num(b, "STEPS")}`); }
          }
        }
        setState({ ...sprite, log: [...sprite.log] });
        return { ...sprite, log: [...sprite.log] };
      };

      window.__blocksSpike = {
        ready: true,
        customBlockTypes: ["ml_whenclassified", "ml_isclass", "ml_confidence"],
        loadProgram: (program) => { Blockly.serialization.workspaces.load(program as never, ws!); },
        classify: run,
        reset: () => { sprite.x = 0; sprite.y = 0; sprite.log = []; setState({ ...sprite }); },
      };
    })();
    return () => { disposed = true; ws?.dispose(); };
  }, []);

  return (
    <main style={{ padding: 16 }}>
      <h1>Spike khối lệnh (Sprint 1)</h1>
      <div ref={host} data-testid="workspace" style={{ height: 420, border: "1px solid #888" }} />
      <p data-testid="sprite">Nhân vật: x={state.x}, y={state.y}</p>
    </main>
  );
}
