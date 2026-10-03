import { requiresChildAgreement, requiresGuardian } from "./age.js";

export type AccountStatus =
  | "PENDING_PARENT_CONSENT"
  | "ACTIVE"
  | "EXPIRED"
  | "ERASURE_REQUESTED"
  | "ERASED";

export interface ConsentState {
  status: AccountStatus;
  age: number;
  guardianVerified: boolean;
  childAgreed: boolean;
}

export type ConsentEvent =
  | { type: "GUARDIAN_VERIFIED" }
  | { type: "CHILD_AGREED" }
  | { type: "TIMEOUT" }
  | { type: "WITHDRAW" }
  | { type: "ERASURE_DONE" };

export function createChildProfile(age: number): ConsentState {
  return {
    // MVP: hồ sơ con <16 luôn do phụ huynh tạo và cần đồng ý; >=16 ngoài trọng tâm MVP nhưng cho ACTIVE.
    status: requiresGuardian(age) ? "PENDING_PARENT_CONSENT" : "ACTIVE",
    age,
    guardianVerified: false,
    childAgreed: false,
  };
}

function isComplete(s: ConsentState): boolean {
  return s.guardianVerified && (!requiresChildAgreement(s.age) || s.childAgreed);
}

/** Hàm thuần: trả trạng thái mới, ném lỗi nếu chuyển không hợp lệ. */
export function transition(state: ConsentState, event: ConsentEvent): ConsentState {
  const bad = (): never => {
    throw new Error(`Invalid transition: ${state.status} + ${event.type}`);
  };
  switch (event.type) {
    case "GUARDIAN_VERIFIED":
    case "CHILD_AGREED": {
      if (state.status !== "PENDING_PARENT_CONSENT") return bad();
      const next = {
        ...state,
        guardianVerified: state.guardianVerified || event.type === "GUARDIAN_VERIFIED",
        childAgreed: state.childAgreed || event.type === "CHILD_AGREED",
      };
      return isComplete(next) ? { ...next, status: "ACTIVE" } : next;
    }
    case "TIMEOUT":
      return state.status === "PENDING_PARENT_CONSENT" ? { ...state, status: "EXPIRED" } : bad();
    case "WITHDRAW":
      return state.status === "ACTIVE" || state.status === "PENDING_PARENT_CONSENT"
        ? { ...state, status: "ERASURE_REQUESTED" }
        : bad();
    case "ERASURE_DONE":
      return state.status === "ERASURE_REQUESTED" || state.status === "EXPIRED"
        ? { ...state, status: "ERASED" }
        : bad();
  }
}
