/** Ngưỡng tuổi theo SRS (FR-010, mục 7.1) và phụ lục (Q2: trẻ <7 chỉ cần phụ huynh). */
export const CHILD_CONSENT_MIN_AGE = 7;
export const GUARDIAN_REQUIRED_BELOW_AGE = 16;

/** Tuổi tròn tại `now`, tính từ năm/tháng sinh (không lưu ngày để giảm PII). */
export function ageInYears(birthYear: number, birthMonth: number, now: Date): number {
  if (birthMonth < 1 || birthMonth > 12) throw new RangeError("birthMonth must be 1..12");
  let age = now.getUTCFullYear() - birthYear;
  // Coi trẻ chưa đủ tuổi cho tới hết tháng sinh nhật (bảo thủ: lấy tuổi nhỏ hơn).
  if (now.getUTCMonth() + 1 <= birthMonth) age -= 1;
  return Math.max(age, 0);
}

export const requiresGuardian = (age: number): boolean => age < GUARDIAN_REQUIRED_BELOW_AGE;
export const requiresChildAgreement = (age: number): boolean => age >= CHILD_CONSENT_MIN_AGE && requiresGuardian(age);
