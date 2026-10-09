import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { DesktopAuthProvider, useDesktopAuth } from "./auth/DesktopAuthContext";
import { DesktopLoginScreen } from "./auth/DesktopLoginScreen";
import { CalculationToolsProvider } from "./context/CalculationToolsContext";
import { UpdateStatusProvider } from "./update/UpdateStatusContext";
import { UpdatePromptHost } from "./update/UpdatePromptHost";
import { LicenseGate } from "./license/LicenseGate";
import { AppShell } from "./shell/AppShell";
import { HomePage } from "./pages/HomePage";
import { LicensePage } from "./pages/LicensePage";
import { KidemPage } from "./pages/KidemPage";
import { SavedCalculationsPage } from "./pages/SavedCalculationsPage";
import { SettingsPage } from "./pages/SettingsPage";
import DavaciUcretiPage from "./pages/hesaplamalar/davaci-ucreti/DavaciUcretiPage";
import ManualBrutWagePage from "./pages/araclar/manuel-brut-ucret/ManualBrutWagePage";
import KidemSelectionPage from "./pages/hesaplamalar/kidem-tazminati/KidemSelectionPage";
import BorclarKidemPage from "./pages/hesaplamalar/kidem-tazminati/borclar/BorclarKidemPage";
import GemiKidemPage from "./pages/hesaplamalar/kidem-tazminati/gemi-adamlari/GemiKidemPage";
import MevsimlikKidemPage from "./pages/hesaplamalar/kidem-tazminati/mevsimlik-isci/MevsimlikKidemPage";
import BasinKidemPage from "./pages/hesaplamalar/kidem-tazminati/basin-is/BasinKidemPage";
import KismiKidemPage from "./pages/hesaplamalar/kidem-tazminati/kismi-sureli/KismiKidemPage";
import BelirliSureliKidemPage from "./pages/hesaplamalar/kidem-tazminati/belirli-sureli/BelirliSureliKidemPage";
import FazlaMesaiSelectionPage from "./pages/hesaplamalar/fazla-mesai/FazlaMesaiSelectionPage";
import StandartFmPage from "./pages/hesaplamalar/fazla-mesai/standart/StandartFmPage";
import TanikliStandartFmPage from "./pages/hesaplamalar/fazla-mesai/tanikli-standart/TanikliStandartFmPage";
import HaftalikKarmaFmPage from "./pages/hesaplamalar/fazla-mesai/haftalik-karma/HaftalikKarmaFmPage";
import DonemselFmPage from "./pages/hesaplamalar/fazla-mesai/donemsel/DonemselFmPage";
import DonemselHaftalikFmPage from "./pages/hesaplamalar/fazla-mesai/donemsel-haftalik/DonemselHaftalikFmPage";
import YeraltiFmPage from "./pages/hesaplamalar/fazla-mesai/yeralti-isci/YeraltiFmPage";
import Vardiya24FmPage from "./pages/hesaplamalar/fazla-mesai/vardiya-24/Vardiya24FmPage";
import Vardiya48FmPage from "./pages/hesaplamalar/fazla-mesai/vardiya-48/Vardiya48FmPage";
import GemiGunlukFmPage from "./pages/hesaplamalar/fazla-mesai/gemi-adami-gunluk/GemiGunlukFmPage";
import Gemi724FmPage from "./pages/hesaplamalar/fazla-mesai/gemi-adami-7-24/Gemi724FmPage";
import EvIsciPage from "./pages/hesaplamalar/fazla-mesai/ev-isci/EvIsciPage";
import PuantajFmPage from "./pages/puantaj-fazla-mesai/PuantajFmPage";
import HaksizFesihTazminatiPage from "./pages/hesaplamalar/haksiz-fesih-tazminati/HaksizFesihTazminatiPage";
import AyrimcilikTazminatiPage from "./pages/hesaplamalar/ayrimcilik-tazminati/AyrimcilikTazminatiPage";
import IseAlmamaTazminatiPage from "./pages/hesaplamalar/ise-almama-tazminati/IseAlmamaTazminatiPage";
import UcretAlacagiPage from "./pages/hesaplamalar/ucret-alacagi/UcretAlacagiPage";
import IsAramaIzniUcretiPage from "./pages/hesaplamalar/is-arama-izni-ucreti/IsAramaIzniUcretiPage";
import PrimAlacagiPage from "./pages/hesaplamalar/prim-alacagi/PrimAlacagiPage";
import KotuNiyetTazminatiPage from "./pages/hesaplamalar/kotu-niyet-tazminati/KotuNiyetTazminatiPage";
import BostaGecenSureUcretiPage from "./pages/hesaplamalar/bosta-gecen-sure-ucreti/BostaGecenSureUcretiPage";
import UbgtSelectionPage from "./pages/hesaplamalar/ubgt/UbgtSelectionPage";
import UbgtAlacagiPage from "./pages/hesaplamalar/ubgt/alacagi/UbgtAlacagiPage";
import UbgtBilirkisiPage from "./pages/hesaplamalar/ubgt/bilirkisi/UbgtBilirkisiPage";
import BakiyeUcretAlacagiPage from "./pages/hesaplamalar/bakiye-ucret-alacagi/BakiyeUcretAlacagiPage";
import IcraTakipSelectionPage from "./pages/hesaplamalar/icra-takip-brutten-nete/IcraTakipSelectionPage";
import DamgaVergisiKesintiliPage from "./pages/hesaplamalar/icra-takip-brutten-nete/damga-vergisi-kesintili/DamgaVergisiKesintiliPage";
import GelirVeDamgaVergisiKesintiliPage from "./pages/hesaplamalar/icra-takip-brutten-nete/gelir-ve-damga-vergisi-kesintili/GelirVeDamgaVergisiKesintiliPage";
import IstisnaliFullKesintiliPage from "./pages/hesaplamalar/icra-takip-brutten-nete/istisnali-full-kesintili/IstisnaliFullKesintiliPage";
import IstisnasizFullKesintiliPage from "./pages/hesaplamalar/icra-takip-brutten-nete/istisnasiz-full-kesintili/IstisnasizFullKesintiliPage";
import HaftaTatiliSelectionPage from "./pages/hesaplamalar/hafta-tatili/HaftaTatiliSelectionPage";
import HaftaTatiliStandardPage from "./pages/hesaplamalar/hafta-tatili/standard/HaftaTatiliStandardPage";
import HaftaTatiliGemiPage from "./pages/hesaplamalar/hafta-tatili/gemi/HaftaTatiliGemiPage";
import HaftaTatiliBasinPage from "./pages/hesaplamalar/hafta-tatili/basin/HaftaTatiliBasinPage";
import IhbarSelectionPage from "./pages/hesaplamalar/ihbar-tazminati/IhbarSelectionPage";
import Ihbar30IsciPage from "./pages/hesaplamalar/ihbar-tazminati/is-kanunu/Ihbar30IsciPage";
import IhbarBorclarPage from "./pages/hesaplamalar/ihbar-tazminati/borclar/IhbarBorclarPage";
import IhbarGemiPage from "./pages/hesaplamalar/ihbar-tazminati/gemi/IhbarGemiPage";
import IhbarMevsimPage from "./pages/hesaplamalar/ihbar-tazminati/mevsim/IhbarMevsimPage";
import IhbarBasinPage from "./pages/hesaplamalar/ihbar-tazminati/basin/IhbarBasinPage";
import IhbarKismiPage from "./pages/hesaplamalar/ihbar-tazminati/kismi/IhbarKismiPage";
import IhbarBelirliPage from "./pages/hesaplamalar/ihbar-tazminati/belirli/IhbarBelirliPage";
import YillikSelectionPage from "./pages/hesaplamalar/yillik-izin/YillikSelectionPage";
import YillikStandartPage from "./pages/hesaplamalar/yillik-izin/standart/YillikStandartPage";
import YillikBorclarPage from "./pages/hesaplamalar/yillik-izin/borclar/YillikBorclarPage";
import YillikGemiPage from "./pages/hesaplamalar/yillik-izin/gemi/YillikGemiPage";
import YillikMevsimPage from "./pages/hesaplamalar/yillik-izin/mevsim/YillikMevsimPage";
import YillikBasinPage from "./pages/hesaplamalar/yillik-izin/basin/YillikBasinPage";
import YillikBasinGunlukOlmayanPage from "./pages/hesaplamalar/yillik-izin/basin/gunluk-olmayan/YillikBasinGunlukOlmayanPage";
import YillikKismiPage from "./pages/hesaplamalar/yillik-izin/kismi/YillikKismiPage";
import YillikBelirliPage from "./pages/hesaplamalar/yillik-izin/belirli/YillikBelirliPage";

export function App() {
  return (
    <HashRouter>
      <UpdateStatusProvider>
        <DesktopAuthProvider>
          <AuthSwitch />
        </DesktopAuthProvider>
        <UpdatePromptHost />
      </UpdateStatusProvider>
    </HashRouter>
  );
}

function AuthSwitch() {
  const auth = useDesktopAuth();
  if (auth.loading) {
    return <div style={{ minHeight: "100vh", background: "#030810" }} />;
  }
  if (!auth.signedIn) {
    return <DesktopLoginScreen />;
  }
  return (
        <CalculationToolsProvider>
          <Routes>
            <Route element={<AppShell />}>
            <Route element={<LicenseGate />}>
              <Route index element={<HomePage />} />
              <Route path="davaci-ucreti" element={<DavaciUcretiPage />} />
              <Route path="araclar/manuel-brut-ucret" element={<ManualBrutWagePage />} />
              <Route path="kidem-tazminati" element={<KidemSelectionPage />} />
              <Route path="kidem-tazminati/30isci" element={<KidemPage />} />
              <Route path="kidem-tazminati/is-kanunu" element={<KidemPage />} />
              <Route path="kidem-tazminati/borclar" element={<BorclarKidemPage />} />
              <Route path="kidem-tazminati/gemi" element={<GemiKidemPage />} />
              <Route path="kidem-tazminati/mevsimlik" element={<MevsimlikKidemPage />} />
              <Route path="kidem-tazminati/basin" element={<BasinKidemPage />} />
              <Route path="kidem-tazminati/kismi-sureli" element={<KismiKidemPage />} />
              <Route path="kidem-tazminati/belirli-sureli" element={<BelirliSureliKidemPage />} />
              <Route path="fazla-mesai" element={<FazlaMesaiSelectionPage />} />
              <Route path="fazla-mesai/standart" element={<StandartFmPage />} />
              <Route path="fazla-mesai/tanikli-standart" element={<TanikliStandartFmPage />} />
              <Route path="fazla-mesai/haftalik-karma" element={<HaftalikKarmaFmPage />} />
              <Route path="fazla-mesai/donemsel" element={<DonemselFmPage />} />
              <Route path="fazla-mesai/donemsel-haftalik" element={<DonemselHaftalikFmPage />} />
              <Route path="fazla-mesai/yeralti-isci" element={<YeraltiFmPage />} />
              <Route path="fazla-mesai/vardiya-24" element={<Vardiya24FmPage />} />
              <Route path="fazla-mesai/vardiya-48" element={<Vardiya48FmPage />} />
              <Route path="fazla-mesai/gemi-adami-gunluk" element={<GemiGunlukFmPage />} />
              <Route path="fazla-mesai/gemi-adami-7-24" element={<Gemi724FmPage />} />
              <Route path="fazla-mesai/ev-isci" element={<EvIsciPage />} />
              <Route path="fazla-mesai/puantaj" element={<PuantajFmPage />} />
              <Route path="haksiz-fesih-tazminati" element={<HaksizFesihTazminatiPage />} />
              <Route path="ayrimcilik-tazminati" element={<AyrimcilikTazminatiPage />} />
              <Route path="ise-almama-tazminati" element={<IseAlmamaTazminatiPage />} />
              <Route path="ucret-alacagi" element={<UcretAlacagiPage />} />
              <Route path="is-arama-izni-ucreti" element={<IsAramaIzniUcretiPage />} />
              <Route path="prim-alacagi" element={<PrimAlacagiPage />} />
              <Route path="kotu-niyet-tazminati" element={<KotuNiyetTazminatiPage />} />
              <Route path="bosta-gecen-sure-ucreti" element={<BostaGecenSureUcretiPage />} />
              <Route path="ubgt" element={<UbgtSelectionPage />} />
              <Route path="ubgt/alacagi" element={<UbgtAlacagiPage />} />
              <Route path="ubgt/bilirkisi" element={<UbgtBilirkisiPage />} />
              <Route path="bakiye-ucret-alacagi" element={<BakiyeUcretAlacagiPage />} />
              <Route path="icra-takip-brutten-nete" element={<IcraTakipSelectionPage />} />
              <Route path="icra-takip-brutten-nete/damga-vergisi-kesintili" element={<DamgaVergisiKesintiliPage />} />
              <Route
                path="icra-takip-brutten-nete/gelir-ve-damga-vergisi-kesintili"
                element={<GelirVeDamgaVergisiKesintiliPage />}
              />
              <Route path="icra-takip-brutten-nete/istisnali-full-kesintili" element={<IstisnaliFullKesintiliPage />} />
              <Route path="icra-takip-brutten-nete/istisnasiz-full-kesintili" element={<IstisnasizFullKesintiliPage />} />
              <Route path="hafta-tatili" element={<HaftaTatiliSelectionPage />} />
              <Route path="hafta-tatili/standard" element={<HaftaTatiliStandardPage />} />
              <Route path="hafta-tatili/gemi-adami" element={<HaftaTatiliGemiPage />} />
              <Route path="hafta-tatili/basin-is" element={<HaftaTatiliBasinPage />} />
              <Route path="ihbar-tazminati" element={<IhbarSelectionPage />} />
              <Route path="ihbar-tazminati/30isci" element={<Ihbar30IsciPage />} />
              <Route path="ihbar-tazminati/borclar" element={<IhbarBorclarPage />} />
              <Route path="ihbar-tazminati/gemi" element={<IhbarGemiPage />} />
              <Route path="ihbar-tazminati/mevsim" element={<IhbarMevsimPage />} />
              <Route path="ihbar-tazminati/basin" element={<IhbarBasinPage />} />
              <Route path="ihbar-tazminati/kismi" element={<IhbarKismiPage />} />
              <Route path="ihbar-tazminati/belirli" element={<IhbarBelirliPage />} />
              <Route path="yillik-izin" element={<YillikSelectionPage />} />
              <Route path="yillik-izin/standart" element={<YillikStandartPage />} />
              <Route path="yillik-izin/borclar" element={<YillikBorclarPage />} />
              <Route path="yillik-izin/gemi" element={<YillikGemiPage />} />
              <Route path="yillik-izin/mevsim" element={<YillikMevsimPage />} />
              <Route path="yillik-izin/basin" element={<YillikBasinPage />} />
              <Route path="yillik-izin/basin/gunluk-olmayan" element={<YillikBasinGunlukOlmayanPage />} />
              <Route path="yillik-izin/kismi" element={<YillikKismiPage />} />
              <Route path="yillik-izin/belirli" element={<YillikBelirliPage />} />
              <Route path="kayitli-hesaplamalar" element={<SavedCalculationsPage />} />
              <Route path="yedekleme" element={<Navigate to="/kayitli-hesaplamalar" replace />} />
              <Route path="ayarlar" element={<SettingsPage />} />
              <Route path="lisans" element={<LicensePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
            </Route>
          </Routes>
        </CalculationToolsProvider>
  );
}
