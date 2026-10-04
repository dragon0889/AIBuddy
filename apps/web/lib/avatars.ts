export const AVATARS: Record<string, string> = { fox: "🦊", owl: "🦉", cat: "🐱", panda: "🐼", robot: "🤖", whale: "🐳", rabbit: "🐰", turtle: "🐢" };
export type Child = {
  id: string; nickname: string; level: 1 | 2 | 3; avatar: string; status: string; guardianVerified: boolean; childAgreed: boolean;
  cameraAllowed: boolean; needsChildAgreement: boolean; consentExpiresAt: string;
};
