export const LOCAL_SECURITY_QUESTIONS = {
  G1: "Annenizin kızlık soyadı nedir?",
  G2: "Doğduğunuz şehir nedir?",
  G3: "İlkokul öğretmeninizin adı nedir?",
  G4: "İlk evcil hayvanınızın adı nedir?",
} as const;

export const LOCAL_SECURITY_QUESTION_CODES = Object.keys(LOCAL_SECURITY_QUESTIONS);

export const DESKTOP_SECURITY_QUESTIONS = Object.values(LOCAL_SECURITY_QUESTIONS);

export const DEMO_EXPIRED_USER_MESSAGE =
  "Deneme süreniz sona ermiştir. Devam etmek için lisans satın alabilirsiniz.";

export function normalizeDesktopUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function desktopUsernameError(raw: string): string | null {
  const username = normalizeDesktopUsername(raw);
  if (username.length < 3 || username.length > 80 || !/^[\p{L}\p{N}._@+-]+(?: [\p{L}\p{N}._@+-]+)*$/u.test(username)) {
    return "Kullanıcı adı 3-80 karakter olmalı. Ad soyad, e-posta veya normal kullanıcı adı yazabilirsiniz.";
  }
  return null;
}

export function localSecurityQuestionCode(raw: string): string | null {
  const value = raw.trim();
  if (LOCAL_SECURITY_QUESTION_CODES.includes(value)) return value;
  const match = Object.entries(LOCAL_SECURITY_QUESTIONS).find(([, text]) => text === value);
  return match ? match[0] : null;
}

export function desktopSecurityQuestionError(raw: string): string | null {
  if (!localSecurityQuestionCode(raw)) return "Güvenlik sorusu listeden seçilmelidir.";
  return null;
}

export function normalizeLocalAnswer(raw: string): string {
  return raw.trim().toLocaleLowerCase("tr-TR");
}

export function publicAuthMessage(message: string | undefined, fallback: string): string {
  const text = (message ?? "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 200) return fallback;
  if (/prisma|sql|stack|node_modules|econn|passwordhash|at \//i.test(text)) return fallback;
  return text;
}
