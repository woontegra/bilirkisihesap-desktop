/**
 * Mevcut sürümü yükseltmeden production build + SSL.com imzalama + imzalı metadata.
 * Şifre ve OTP, komutun çalıştığı terminalde sorulur.
 */
process.env.RELEASE_UPDATE_SKIP_BUMP = "1";
require("./run-release-update.cjs");
