export interface Sample {
  embedding: Float32Array;
  label: number;
}

/** Chia train/test phân tầng theo nhãn (giữ nguyên thứ tự trong mỗi nhãn, kiểm thử lấy mẫu cuối). */
export function splitStratified(samples: Sample[], testFraction = 0.2): { train: Sample[]; test: Sample[] } {
  const byLabel = new Map<number, Sample[]>();
  for (const s of samples) byLabel.set(s.label, [...(byLabel.get(s.label) ?? []), s]);
  const train: Sample[] = [];
  const test: Sample[] = [];
  for (const group of byLabel.values()) {
    const nTest = Math.max(1, Math.round(group.length * testFraction));
    train.push(...group.slice(0, group.length - nTest));
    test.push(...group.slice(group.length - nTest));
  }
  return { train, test };
}
