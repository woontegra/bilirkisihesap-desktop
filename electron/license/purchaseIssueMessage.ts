export function purchaseIssueFailureMessage(issued: {
  message?: string | null;
  error?: string | null;
}): string {
  const serverMessage = issued.message?.trim() || issued.error?.trim() || "";
  return serverMessage || "Satın alma bağlantısı oluşturulamadı.";
}
