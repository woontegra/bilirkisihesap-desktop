import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Calculator, Eye, EyeOff, Lock, Scale, Shield, Sparkles, TrendingUp, Zap } from "lucide-react";
import { PRODUCT_VERSION } from "@/appVersion";
import logoUrl from "@/assets/logo.png";
import { LOCAL_SECURITY_QUESTIONS, desktopSecurityQuestionError } from "../../shared/desktopAuthAccount";
import { loginSecondaryActions } from "../../shared/desktopAuthFlow";
import { useDesktopAuth } from "./DesktopAuthContext";
import styles from "./DesktopLogin.module.css";

const HERO_WORDS = ["Fazla Mesai", "Kıdem Tazminatı", "İhbar Tazminatı", "Yıllık İzin", "UBGT"];
const FLOAT_ICONS = [Calculator, Scale, TrendingUp, Sparkles] as const;
const REMEMBER_USERNAME_KEY = "bilirkisi-desktop-remember-username";

type Panel = "login" | "forgot" | "paid-activate" | "demo-start" | "local-setup" | "choose" | "blocked";

function useRotatingWord(words: string[], intervalMs = 2800) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 960px)");
    let id: number | undefined;

    const sync = () => {
      if (id !== undefined) window.clearInterval(id);
      id = undefined;
      if (!desktop.matches) return;
      id = window.setInterval(() => {
        setIndex((prev) => (prev + 1) % words.length);
      }, intervalMs);
    };

    sync();
    desktop.addEventListener("change", sync);
    return () => {
      if (id !== undefined) window.clearInterval(id);
      desktop.removeEventListener("change", sync);
    };
  }, [words.length, intervalMs]);

  return words[index];
}

export function DesktopLoginScreen() {
  const auth = useDesktopAuth();
  const view = auth.view;
  const pageRef = useRef<HTMLDivElement>(null);
  const usernameId = useId();
  const passwordId = useId();
  const netGradId = useId().replace(/:/g, "");
  const rotatingWord = useRotatingWord(HERO_WORDS);
  const [mounted, setMounted] = useState(false);
  const [panel, setPanel] = useState<Panel>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [activationPassword, setActivationPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [trialEmail, setTrialEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const actions = loginSecondaryActions({
    step: view?.step ?? "login",
    storedKind: view?.licenseKind ?? "none",
  });

  const bokeh = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${(i * 19 + 5) % 100}%`,
        top: `${(i * 27 + 9) % 100}%`,
        size: 80 + (i % 5) * 48,
        delay: `${(i % 9) * 0.6}s`,
        duration: `${14 + (i % 6) * 3}s`,
        tone: i % 3,
      })),
    [],
  );

  useEffect(() => {
    const remembered = localStorage.getItem(REMEMBER_USERNAME_KEY);
    if (remembered) {
      setUsername(remembered);
      setRememberMe(true);
    }
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    if (window.matchMedia("(pointer: coarse)").matches) return undefined;

    const onMove = (event: MouseEvent) => {
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;
      page.style.setProperty("--mx", x.toFixed(4));
      page.style.setProperty("--my", y.toFixed(4));
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    if (!view || view.mock) return;
    if (view.step === "local-setup" || view.step === "login" || view.step === "blocked" || view.step === "choose") {
      setPanel(view.step);
    }
    setError(view.message);
  }, [view]);

  async function run(task: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "İşlem tamamlanamadı");
    } finally {
      setBusy(false);
    }
  }

  function returnPanel(): Panel {
    if (view?.step === "choose" || view?.step === "blocked" || view?.step === "login" || view?.step === "local-setup") {
      return view.step;
    }
    return "choose";
  }

  function rememberUsername() {
    if (rememberMe) localStorage.setItem(REMEMBER_USERNAME_KEY, username.trim());
    else localStorage.removeItem(REMEMBER_USERNAME_KEY);
  }

  async function onLogin(event: FormEvent): Promise<void> {
    event.preventDefault();
    await run(async () => {
      const result = await window.bilirkisiDesktop.loginDesktopAuth({ username, password });
      if (!result.ok) throw new Error(result.message);
      rememberUsername();
      await auth.refresh();
    });
  }

  async function onActivate(event: FormEvent): Promise<void> {
    event.preventDefault();
    await run(async () => {
      const result = await window.bilirkisiDesktop.activateLicense({
        licenseKey,
        activationPassword,
      });
      if (!result.ok) throw new Error(result.message);
      setActivationPassword("");
      setNotice("Lisans etkin. Bu bilgisayarda bir kez yerel hesap oluşturun.");
      await auth.refresh();
    });
  }

  async function onStartTrial(event: FormEvent): Promise<void> {
    event.preventDefault();
    await run(async () => {
      const questionError = desktopSecurityQuestionError(securityQuestion);
      if (questionError) throw new Error(questionError);
      if (password.length < 6) throw new Error("Şifre en az 6 karakter olmalıdır.");
      const started = await window.bilirkisiDesktop.startTrial({ email: trialEmail, phone });
      if (!started.ok) throw new Error(started.message);
      const account = await window.bilirkisiDesktop.createDesktopAuthAccount({
        fullName,
        email: trialEmail,
        phone,
        password,
        securityQuestion,
        securityAnswer,
      });
      if (!account.ok) {
        await auth.refresh();
        throw new Error(`${account.message} Deneme kaydınız duruyor; yeni demo açılmaz.`);
      }
      await auth.refresh();
    });
  }

  async function onCreateLocal(event: FormEvent): Promise<void> {
    event.preventDefault();
    await run(async () => {
      const questionError = desktopSecurityQuestionError(securityQuestion);
      if (questionError) throw new Error(questionError);
      const result = await window.bilirkisiDesktop.createDesktopAuthAccount({
        fullName,
        email: trialEmail || username,
        phone,
        password,
        securityQuestion,
        securityAnswer,
      });
      if (!result.ok) throw new Error(result.message);
      await auth.refresh();
    });
  }

  async function onRenew(): Promise<void> {
    await run(async () => {
      const result = await window.bilirkisiDesktop.openDesktopRenewal();
      if (!result.ok) throw new Error(result.message);
      setNotice(result.data.message);
    });
  }

  async function onForgotStart(event: FormEvent): Promise<void> {
    event.preventDefault();
    await run(async () => {
      const result = await window.bilirkisiDesktop.startDesktopAuthReset(username);
      if (!result.ok) throw new Error(result.message);
      setSecurityQuestion(result.data.securityQuestion);
      setNotice("Güvenlik sorunuzu cevaplayıp yeni parolayı yazın.");
    });
  }

  async function onForgotComplete(event: FormEvent): Promise<void> {
    event.preventDefault();
    await run(async () => {
      const result = await window.bilirkisiDesktop.completeDesktopAuthReset({
        username,
        securityAnswer,
        newPassword: password,
      });
      if (!result.ok) throw new Error(result.message);
      setPassword("");
      setNotice("Parola güncellendi. Yeni parolanızla giriş yapın.");
      setPanel("login");
    });
  }

  return (
    <div
      ref={pageRef}
      className={`${styles.page} ${mounted ? styles.pageMounted : ""}`}
      style={{ "--mx": 0, "--my": 0 } as CSSProperties}
    >
      <div className={styles.bg} aria-hidden>
        <div className={styles.bgBase} />
        <div className={styles.bgNoise} />
        <div className={styles.lightBeams}>
          <div className={styles.beam} data-beam="1" />
          <div className={styles.beam} data-beam="2" />
          <div className={styles.beam} data-beam="3" />
        </div>
        <div className={styles.aurora} />
        <svg className={styles.network} viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id={netGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(94, 200, 216, 0.35)" />
              <stop offset="100%" stopColor="rgba(26, 111, 124, 0.08)" />
            </linearGradient>
          </defs>
          <g className={styles.networkLines} stroke={`url(#${netGradId})`} strokeWidth="0.75" fill="none">
            <path d="M0 420 Q 300 280 520 380 T 1200 320" />
            <path d="M0 580 Q 400 440 680 520 T 1200 480" />
            <path d="M120 0 Q 360 200 600 120 T 1200 80" />
            <path d="M80 800 Q 420 620 760 700 T 1200 760" />
            <circle cx="520" cy="380" r="3" fill="rgba(126, 232, 248, 0.5)" />
            <circle cx="680" cy="520" r="2.5" fill="rgba(126, 232, 248, 0.4)" />
            <circle cx="360" cy="200" r="2" fill="rgba(200, 170, 90, 0.45)" />
            <circle cx="900" cy="320" r="2.5" fill="rgba(126, 232, 248, 0.35)" />
          </g>
        </svg>
        {bokeh.map((b) => (
          <span
            key={b.id}
            className={styles.bokeh}
            data-tone={b.tone}
            style={{
              left: b.left,
              top: b.top,
              width: b.size,
              height: b.size,
              animationDelay: b.delay,
              animationDuration: b.duration,
            }}
          />
        ))}
        <div className={`${styles.orb} ${styles.orbA}`} />
        <div className={`${styles.orb} ${styles.orbB}`} />
        <div className={`${styles.orb} ${styles.orbC}`} />
        <div className={styles.spotlight} />
        <div className={styles.vignette} />
      </div>

      <div className={styles.layout}>
        <aside className={styles.hero} aria-label="Tanıtım">
          <div className={styles.heroInner}>
            <span className={styles.heroBadge}>
              <Zap size={14} aria-hidden />
              Yeni nesil hesaplama motoru
            </span>

            <h1 className={styles.heroTitle}>
              Bilirkişi hesaplamalarında
              <span className={styles.heroTitleAccent}>
                <span key={rotatingWord} className={styles.heroWordSwap}>
                  {rotatingWord}
                </span>
              </span>
            </h1>

            <p className={styles.heroSub}>
              Hızlı, güvenilir ve profesyonel. Tüm iş hukuku hesaplamalarınız tek panelde — saniyeler içinde sonuç.
            </p>

            <ul className={styles.heroStats}>
              <li>
                <strong>50+</strong>
                <span>hesaplama türü</span>
              </li>
              <li>
                <strong>v3.6</strong>
                <span>güncel motor</span>
              </li>
              <li>
                <strong>7/24</strong>
                <span>erişim</span>
              </li>
            </ul>

            <div className={styles.floatingIcons} aria-hidden>
              {FLOAT_ICONS.map((Icon, i) => (
                <div key={Icon.name} className={styles.floatingIcon} data-index={i}>
                  <Icon size={22} strokeWidth={1.75} />
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className={styles.main}>
          <div className={styles.cardShell}>
            <div className={styles.cardBorder} aria-hidden />
            <div className={styles.cardGlow} aria-hidden />

            <div className={styles.card}>
              <span className={styles.versionBadge}>v{PRODUCT_VERSION}</span>

              <header className={styles.brand}>
                <div className={styles.logoSlot}>
                  <img src={logoUrl} alt="Bilirkişi Hesap" className={styles.logo} />
                </div>
                <h2 className={styles.title}>Hoş geldiniz</h2>
                <p className={styles.sub}>
                  <Shield size={15} className={styles.subIcon} aria-hidden />
                  {panel === "login" ? "Hesabınıza güvenli giriş yapın" : panelSubtitle(panel)}
                </p>
              </header>

              {panel === "choose" ? (
                <div className={styles.form}>
                  <p className={styles.sub}>7 gün ücretsiz deneyin veya satın aldığınız lisansı etkinleştirin.</p>
                  {error ? <p className={styles.error} role="alert">{error}</p> : null}
                  <button type="button" className={styles.submit} onClick={() => setPanel("demo-start")}>
                    <span className={styles.submitInner}>7 Gün Ücretsiz Dene</span>
                  </button>
                  <button type="button" className={styles.forgotLink} onClick={() => setPanel("paid-activate")}>
                    Lisansımı Etkinleştir
                  </button>
                </div>
              ) : null}

              {panel === "login" ? (
                <form className={styles.form} onSubmit={(event) => void onLogin(event)}>
                  <Field id={usernameId} label="Kullanıcı adı" icon="user" value={username} onChange={setUsername} autoComplete="username" placeholder="ad soyad, e-posta veya kullanıcı adı" />
                  <PasswordField id={passwordId} value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} />
                  <label className={styles.remember}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className={styles.checkbox}
                    />
                    <span>Beni hatırla</span>
                  </label>
                  {error ? <p className={styles.error} role="alert">{error}</p> : null}
                  {notice ? <p className={styles.sub}>{notice}</p> : null}
                  <Submit busy={busy} label="Giriş Yap" />
                  {actions.includes("forgot-password") ? (
                    <button type="button" className={styles.forgotLink} onClick={() => setPanel("forgot")}>
                      Şifremi unuttum
                    </button>
                  ) : null}
                </form>
              ) : null}

              {panel === "paid-activate" ? (
                <form className={styles.form} onSubmit={(event) => void onActivate(event)}>
                  <Field label="Lisans anahtarı" value={licenseKey} onChange={setLicenseKey} autoComplete="off" />
                  <Field label="Aktivasyon şifresi" value={activationPassword} onChange={setActivationPassword} autoComplete="off" secret />
                  {error ? <p className={styles.error} role="alert">{error}</p> : null}
                  {notice ? <p className={styles.sub}>{notice}</p> : null}
                  <Submit busy={busy} label="Lisansı etkinleştir" />
                  <button type="button" className={styles.forgotLink} onClick={() => setPanel(returnPanel())}>
                    Geri dön
                  </button>
                </form>
              ) : null}

              {panel === "demo-start" ? (
                <form className={styles.form} onSubmit={(event) => void onStartTrial(event)}>
                  <Field label="Ad soyad" value={fullName} onChange={setFullName} autoComplete="name" />
                  <Field label="E-posta" value={trialEmail} onChange={setTrialEmail} autoComplete="email" placeholder="ornek@firma.com" />
                  <Field label="Cep telefonu" value={phone} onChange={setPhone} autoComplete="tel" placeholder="05xx xxx xx xx" />
                  <PasswordField value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} />
                  <QuestionField value={securityQuestion} onChange={setSecurityQuestion} />
                  <Field label="Güvenlik cevabı" value={securityAnswer} onChange={setSecurityAnswer} autoComplete="off" />
                  {error ? <p className={styles.error} role="alert">{error}</p> : null}
                  {notice ? <p className={styles.sub}>{notice}</p> : null}
                  <Submit busy={busy} label="Demoyu başlat" />
                  <button type="button" className={styles.forgotLink} onClick={() => setPanel("choose")}>
                    Geri dön
                  </button>
                </form>
              ) : null}

              {panel === "local-setup" ? (
                <form className={styles.form} onSubmit={(event) => void onCreateLocal(event)}>
                  <p className={styles.sub}>Mevcut lisansınız duruyor. Bu bilgisayar için bir kez hesap oluşturun. Yeni demo açılmaz.</p>
                  <Field label="Ad soyad" value={fullName} onChange={setFullName} autoComplete="name" />
                  <Field label="E-posta" value={trialEmail} onChange={setTrialEmail} autoComplete="email" placeholder="ornek@firma.com" />
                  <Field label="Cep telefonu" value={phone} onChange={setPhone} autoComplete="tel" placeholder="İsteğe bağlı" optional />
                  <PasswordField value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} />
                  <QuestionField value={securityQuestion} onChange={setSecurityQuestion} />
                  <Field label="Güvenlik cevabı" value={securityAnswer} onChange={setSecurityAnswer} autoComplete="off" />
                  {error ? <p className={styles.error} role="alert">{error}</p> : null}
                  {notice ? <p className={styles.sub}>{notice}</p> : null}
                  <Submit busy={busy} label="Hesabı oluştur" />
                </form>
              ) : null}

              {panel === "forgot" ? (
                <form className={styles.form} onSubmit={(event) => (securityQuestion ? void onForgotComplete(event) : void onForgotStart(event))}>
                  <Field label="Kullanıcı adı" value={username} onChange={setUsername} autoComplete="username" />
                  {securityQuestion ? (
                    <>
                      <p className={styles.sub}>{securityQuestion}</p>
                      <Field label="Güvenlik cevabı" value={securityAnswer} onChange={setSecurityAnswer} autoComplete="off" />
                      <PasswordField value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} label="Yeni parola" />
                    </>
                  ) : null}
                  {error ? <p className={styles.error} role="alert">{error}</p> : null}
                  {notice ? <p className={styles.sub}>{notice}</p> : null}
                  <Submit busy={busy} label={securityQuestion ? "Parolayı güncelle" : "Güvenlik sorusunu göster"} />
                  <button type="button" className={styles.forgotLink} onClick={() => setPanel("login")}>
                    Girişe dön
                  </button>
                </form>
              ) : null}

              {panel === "blocked" ? (
                <div className={styles.form}>
                  <p className={styles.error} role="alert">{view?.message || "Lisans veya demo hakkı girişe izin vermiyor."}</p>
                  {notice ? <p className={styles.sub}>{notice}</p> : null}
                  {actions.includes("renew-license") ? (
                    <button type="button" className={styles.submit} disabled={busy} onClick={() => void onRenew()}>
                      <span className={styles.submitInner}>Lisansı Yenile</span>
                    </button>
                  ) : null}
                  {actions.includes("activate-license") ? (
                    <button type="button" className={styles.forgotLink} onClick={() => setPanel("paid-activate")}>
                      Satın alınmış lisansı etkinleştir
                    </button>
                  ) : null}
                </div>
              ) : null}

              <footer className={styles.footer}>
                <span className={styles.statusDot} aria-hidden />
                Sistem aktif · Bilirkişi Hesap v{PRODUCT_VERSION}
              </footer>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function panelSubtitle(panel: Panel): string {
  if (panel === "choose") return "Deneme programın içinde başlar";
  if (panel === "local-setup") return "Mevcut lisans için yerel hesap";
  if (panel === "paid-activate") return "Lisans anahtarı ve aktivasyon şifresi";
  if (panel === "demo-start") return "Süre, demoyu bu cihazda başlattığınız anda başlar";
  if (panel === "forgot") return "Güvenlik sorusu bu bilgisayarda doğrulanır";
  if (panel === "blocked") return "Giriş şu anda tamamlanamıyor";
  return "Hesabınıza güvenli giriş yapın";
}

function Field({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  secret = false,
  icon = "lock",
  optional = false,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
  secret?: boolean;
  icon?: "user" | "lock";
  optional?: boolean;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={fieldId}>
        {icon === "user" ? <Sparkles size={14} className={styles.iconAmber} aria-hidden /> : <Lock size={14} className={styles.iconTeal} aria-hidden />}
        {label}
      </label>
      <div className={styles.inputWrap}>
        <input
          id={fieldId}
          className={styles.input}
          type={secret ? "password" : "text"}
          autoComplete={autoComplete}
          required={!optional}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className={styles.inputGlow} aria-hidden />
      </div>
    </div>
  );
}

function QuestionField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const fieldId = useId();
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={fieldId}>
        <Lock size={14} className={styles.iconTeal} aria-hidden />
        Güvenlik sorusu
      </label>
      <div className={styles.inputWrap}>
        <select
          id={fieldId}
          className={styles.input}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Soru seçin</option>
          {Object.entries(LOCAL_SECURITY_QUESTIONS).map(([code, question]) => (
            <option key={code} value={code}>
              {question}
            </option>
          ))}
        </select>
        <span className={styles.inputGlow} aria-hidden />
      </div>
    </div>
  );
}

function PasswordField({
  id,
  value,
  onChange,
  show,
  onToggle,
  label = "Parola",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  label?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={fieldId}>
        <Lock size={14} className={styles.iconTeal} aria-hidden />
        {label}
      </label>
      <div className={styles.inputWrap}>
        <input
          id={fieldId}
          className={styles.input}
          type={show ? "text" : "password"}
          autoComplete="current-password"
          required
          placeholder="••••••••"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className={styles.togglePassword}
          onClick={onToggle}
          tabIndex={-1}
          aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
        <span className={styles.inputGlow} aria-hidden />
      </div>
    </div>
  );
}

function Submit({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button type="submit" className={styles.submit} disabled={busy}>
      <span className={styles.submitShine} aria-hidden />
      <span className={styles.submitRing} aria-hidden />
      <span className={styles.submitInner}>
        {busy ? (
          <>
            <span className={styles.spinner} aria-hidden />
            {label === "Giriş Yap" ? "Giriş yapılıyor…" : "Bekleyin…"}
          </>
        ) : (
          <>
            <Shield size={17} aria-hidden />
            {label}
          </>
        )}
      </span>
    </button>
  );
}
