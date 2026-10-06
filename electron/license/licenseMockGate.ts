export function shouldUseMockLicense(options: {
  packaged: boolean;
  licenseUseMock: string | undefined;
  nodeEnv: string | undefined;
}): boolean {
  if (options.packaged) {
    return false;
  }
  if (options.nodeEnv === "production") {
    return false;
  }
  if (options.licenseUseMock === "0") {
    return false;
  }
  return true;
}
