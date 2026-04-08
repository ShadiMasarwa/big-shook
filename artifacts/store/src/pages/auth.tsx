import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import {
  Package,
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
  Mail,
  Gift,
  Lock,
} from "lucide-react";

// ── Password validation ───────────────────────────────────────────────────────
const PWD_RULES = [
  { id: "len", label: "לפחות 8 תווים", test: (p: string) => p.length >= 8 },
  {
    id: "upper",
    label: "אות גדולה באנגלית (A-Z)",
    test: (p: string) => /[A-Z]/.test(p),
  },
  {
    id: "lower",
    label: "אות קטנה באנגלית (a-z)",
    test: (p: string) => /[a-z]/.test(p),
  },
  {
    id: "digit",
    label: "לפחות ספרה אחת (0-9)",
    test: (p: string) => /[0-9]/.test(p),
  },
  {
    id: "special",
    label: "תו מיוחד (!@#$%...)",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
  {
    id: "eng",
    label: "אנגלית בלבד (ללא עברית)",
    test: (p: string) => !/[\u0590-\u05FF]/.test(p),
  },
];

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function allPwdValid(p: string) {
  return PWD_RULES.every((r) => r.test(p));
}

// ── OTP Input ────────────────────────────────────────────────────────────────
function OtpInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[i] && i > 0)
      refs.current[i - 1]?.focus();
  };

  const handleChange = (i: number, ch: string) => {
    if (!/^\d*$/.test(ch)) return;
    const arr = value.padEnd(6, " ").split("");
    arr[i] = ch.slice(-1) || " ";
    const next = arr.join("").trimEnd();
    onChange(next);
    if (ch && i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(text);
    refs.current[Math.min(text.length, 5)]?.focus();
  };

  return (
    <div
      className="flex justify-center"
      role="group"
      aria-label="הזנת קוד אימות בן 6 ספרות"
    >
      <div className="relative" style={{ width: 318, height: 56 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[i] ?? ""}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={handlePaste}
            aria-label={`ספרה ${i + 1} מתוך 6`}
            aria-required="true"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            style={{
              position: "absolute",
              left: i * 54,
              top: 0,
              width: 48,
              height: 56,
            }}
            className="text-center text-2xl font-bold border-2 border-border rounded-xl bg-background focus:border-primary focus:outline-none transition-colors"
          />
        ))}
      </div>
    </div>
  );
}

// ── Countdown ─────────────────────────────────────────────────────────────────
function Countdown({
  seconds,
  onExpire,
}: {
  seconds: number;
  onExpire: () => void;
}) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const id = setInterval(
      () =>
        setLeft((l) => {
          if (l <= 1) {
            clearInterval(id);
            onExpire();
            return 0;
          }
          return l - 1;
        }),
      1000,
    );
    return () => clearInterval(id);
  }, [seconds]);
  const m = Math.floor(left / 60),
    s = left % 60;
  return (
    <span
      className={
        left < 30 ? "text-destructive font-bold" : "text-muted-foreground"
      }
    >
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

// ── Forgot Password Dialog ────────────────────────────────────────────────────
function ForgotPasswordDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  function handleOpenChange(v: boolean) {
    if (!v) {
      onClose();
      setTimeout(() => { setEmail(""); setError(""); setSent(false); setLoading(false); }, 300);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email) { setError("אנא הזן כתובת אימייל"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "שגיאה בשליחת הבקשה"); return; }
      setSent(true);
    } catch {
      setError("שגיאת תקשורת. אנא נסה שוב.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-sm rounded-2xl"
        dir="rtl"
        aria-label="שחזור סיסמה"
      >
        <DialogTitle className="text-xl font-bold text-center">שכחתי סיסמה</DialogTitle>

        {sent ? (
          <div className="py-4 text-center space-y-3">
            <div className="flex justify-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <Mail className="h-7 w-7" />
              </div>
            </div>
            <p className="font-semibold text-green-700">הקישור נשלח!</p>
            <p className="text-sm text-muted-foreground">
              אם הכתובת <span dir="ltr" className="font-mono font-semibold">{email}</span> קיימת במערכת,
              ישלח אליה קישור לאיפוס הסיסמה תוך מספר דקות.
            </p>
            <p className="text-xs text-muted-foreground">הקישור בתוקף ל-24 שעות.</p>
            <Button className="w-full mt-2" onClick={onClose}>סגור</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2" noValidate>
            <div className="flex justify-center mb-2">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <Lock className="h-7 w-7" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              הזן את כתובת האימייל של חשבונך ונשלח לך קישור לאיפוס הסיסמה.
            </p>
            <div className="space-y-2">
              <Label htmlFor="forgot-email">אימייל</Label>
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                dir="ltr"
                autoComplete="email"
                aria-required="true"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert" aria-live="assertive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "שלח קישור לאיפוס"}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-muted-foreground hover:text-primary underline"
              >
                ביטול
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Auth() {
  const { login, user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("login");

  // Read ?redirect= param so we can bounce back after login/register
  const redirectTo = (() => {
    try {
      const r =
        new URLSearchParams(window.location.search).get("redirect") ?? "";
      // Only allow relative paths that start with /
      return r.startsWith("/") && !r.startsWith("//") ? r : "/";
    } catch {
      return "/";
    }
  })();

  // Forgot password dialog
  const [forgotOpen, setForgotOpen] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginShowPwd, setLoginShowPwd] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginInactive, setLoginInactive] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register – step 1
  const [regStep, setRegStep] = useState<"form" | "otp" | "done">("form");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regEmailError, setRegEmailError] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdTouched, setPwdTouched] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToMarketing, setAgreedToMarketing] = useState(true);
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // Register – step 2 (OTP)
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpExpired, setOtpExpired] = useState(false);
  const [otpKey, setOtpKey] = useState(0); // reset countdown

  // Success
  const [showSuccess, setShowSuccess] = useState(false);
  const [successName, setSuccessName] = useState("");
  const [welcomePoints, setWelcomePoints] = useState(0);

  if (user) {
    setLocation(user.role === "admin" ? "/admin" : redirectTo);
    return null;
  }

  // ── Login submit ────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginInactive(false);
    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "account_inactive") {
          setLoginInactive(true);
        } else {
          setLoginError(data.error ?? "שגיאה בהתחברות");
        }
        return;
      }
      localStorage.setItem("token", data.token);
      setLocation(data.user?.role === "admin" ? "/admin" : redirectTo);
      window.location.reload();
    } catch {
      setLoginError("שגיאה בהתחברות. נסה שנית.");
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Email blur check ────────────────────────────────────────────────────────
  const checkEmail = async () => {
    if (!regEmail) return;
    if (!isValidEmail(regEmail)) {
      setRegEmailError("כתובת אימייל לא תקינה");
      return;
    }
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail }),
      });
      const data = await res.json();
      setRegEmailError(data.available ? "" : "כתובת האימייל כבר קיימת במערכת");
    } catch {
      /* ignore */
    }
  };

  // ── Register step 1 submit ──────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");

    if (!isValidEmail(regEmail)) {
      setRegEmailError("כתובת אימייל לא תקינה");
      return;
    }
    if (regEmailError) return;
    if (!allPwdValid(regPassword)) {
      setRegError("הסיסמה אינה עומדת בדרישות");
      return;
    }
    if (regPassword !== regConfirm) {
      setRegError("הסיסמאות אינן תואמות");
      return;
    }
    if (!agreedToTerms) {
      setRegError("יש לאשר את קריאת תקנון האתר כדי להמשיך");
      return;
    }

    setRegLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: regEmail,
          password: regPassword,
          firstName: regFirstName,
          lastName: regLastName,
          phone: regPhone,
          marketingEmails: agreedToMarketing,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) setRegEmailError(data.error);
        else setRegError(data.error ?? "שגיאה בשליחת קוד");
        return;
      }
      setDevOtp(data.devOtp ?? null);
      setOtpValue("");
      setOtpExpired(false);
      setOtpKey((k) => k + 1);
      setRegStep("otp");
    } catch {
      setRegError("שגיאה בשליחת קוד. נסה שנית.");
    } finally {
      setRegLoading(false);
    }
  };

  // ── OTP verify ──────────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpValue.length < 6) {
      setOtpError("יש להזין קוד בן 6 ספרות");
      return;
    }
    setOtpError("");
    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail, otp: otpValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error ?? "קוד שגוי");
        return;
      }
      localStorage.setItem("token", data.token);
      setSuccessName(data.user.firstName);
      setWelcomePoints(data.welcomePoints ?? 0);
      setRegStep("done");
      setShowSuccess(true);
    } catch {
      setOtpError("שגיאה באימות. נסה שנית.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = () => {
    setOtpValue("");
    setOtpError("");
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    handleSendOtp(fakeEvent);
  };

  // ── Password rules display ──────────────────────────────────────────────────
  const pwdRulesList = pwdTouched && (
    <div className="grid grid-cols-2 gap-1 mt-2">
      {PWD_RULES.map((r) => {
        const ok = r.test(regPassword);
        return (
          <div
            key={r.id}
            className={`flex items-center gap-1 text-xs ${ok ? "text-green-600" : "text-muted-foreground"}`}
          >
            {ok ? (
              <Check className="h-3 w-3 shrink-0" />
            ) : (
              <X className="h-3 w-3 shrink-0" />
            )}
            {r.label}
          </div>
        );
      })}
    </div>
  );

  return (
    <Layout>
      <div className="min-h-[calc(100vh-400px)] flex items-center justify-center py-16 px-4">
        <div
          className="w-full max-w-md bg-card border border-border shadow-lg rounded-2xl p-8"
          dir="rtl"
        >
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Package className="h-8 w-8" />
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v);
              setRegStep("form");
              setRegError("");
            }}
            className="w-full"
            dir="rtl"
          >
            <TabsList
              className="grid w-full grid-cols-2 mb-8 h-12 bg-muted p-1"
              dir="rtl"
            >
              <TabsTrigger
                value="login"
                className="text-base rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                התחברות
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="text-base rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                הרשמה
              </TabsTrigger>
            </TabsList>

            {/* ── LOGIN ── */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4" dir="rtl" noValidate aria-label="טופס התחברות">
                <div className="space-y-2">
                  <Label htmlFor="login-email">אימייל</Label>
                  <Input
                    id="login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                    dir="ltr"
                    autoComplete="email"
                    aria-required="true"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">סיסמה</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={loginShowPwd ? "text" : "password"}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pr-10"
                      dir="ltr"
                      autoComplete="current-password"
                      aria-required="true"
                    />
                    <button
                      type="button"
                      onClick={() => setLoginShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={loginShowPwd ? "הסתר סיסמה" : "הצג סיסמה"}
                    >
                      {loginShowPwd ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    שכחתי סיסמה
                  </button>
                </div>
                {loginInactive && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 space-y-1"
                  >
                    <p className="font-semibold">החשבון שלך מושהה</p>
                    <p>לשאלות ולהפעלת החשבון, פנה אלינו במייל:</p>
                    <a
                      href="mailto:support@bigshook.com"
                      className="font-bold underline underline-offset-2 hover:text-orange-900"
                      dir="ltr"
                    >
                      support@bigshook.com
                    </a>
                  </div>
                )}
                {loginError && (
                  <p role="alert" aria-live="assertive" className="text-sm text-destructive">{loginError}</p>
                )}
                <Button
                  type="submit"
                  className="w-full h-12 text-lg font-bold mt-4"
                  disabled={loginLoading}
                >
                  {loginLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "התחבר"
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* ── REGISTER ── */}
            <TabsContent value="register">
              {/* STEP 1: Form */}
              {regStep === "form" && (
                <form onSubmit={handleSendOtp} className="space-y-4" dir="rtl" noValidate aria-label="טופס הרשמה">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-first-name">
                        שם פרטי{" "}
                        <span className="text-destructive font-bold" aria-hidden="true">*</span>
                      </Label>
                      <Input
                        id="reg-first-name"
                        required
                        value={regFirstName}
                        onChange={(e) => setRegFirstName(e.target.value)}
                        placeholder="ישראל"
                        autoComplete="given-name"
                        aria-required="true"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-last-name">שם משפחה <span className="text-destructive font-bold" aria-hidden="true">*</span></Label>
                      <Input
                        id="reg-last-name"
                        required
                        value={regLastName}
                        onChange={(e) => setRegLastName(e.target.value)}
                        placeholder="ישראלי"
                        autoComplete="family-name"
                        aria-required="true"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-email">אימייל <span className="text-destructive font-bold" aria-hidden="true">*</span></Label>
                    <Input
                      id="reg-email"
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        setRegEmailError("");
                      }}
                      onBlur={checkEmail}
                      placeholder="you@example.com"
                      dir="ltr"
                      autoComplete="email"
                      aria-required="true"
                      aria-describedby={regEmailError ? "reg-email-error" : undefined}
                      aria-invalid={!!regEmailError}
                      className={
                        regEmailError
                          ? "border-destructive focus-visible:ring-destructive"
                          : ""
                      }
                    />
                    {regEmailError && (
                      <p id="reg-email-error" role="alert" className="text-xs text-destructive">
                        {regEmailError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-phone">טלפון <span className="text-destructive font-bold" aria-hidden="true">*</span></Label>
                    <Input
                      id="reg-phone"
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="050-0000000"
                      dir="ltr"
                      autoComplete="tel"
                      aria-required="true"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-password">סיסמה <span className="text-destructive font-bold" aria-hidden="true">*</span></Label>
                    <div className="relative">
                      <Input
                        id="reg-password"
                        type={showPwd ? "text" : "password"}
                        required
                        value={regPassword}
                        onChange={(e) => {
                          setRegPassword(e.target.value);
                          setPwdTouched(true);
                        }}
                        className="pr-10"
                        dir="ltr"
                        placeholder="Aa1!••••"
                        autoComplete="new-password"
                        aria-required="true"
                        aria-describedby="pwd-rules"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPwd ? "הסתר סיסמה" : "הצג סיסמה"}
                      >
                        {showPwd ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <div id="pwd-rules" aria-live="polite">
                    {pwdRulesList}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm">אימות סיסמה <span className="text-destructive font-bold" aria-hidden="true">*</span></Label>
                    <div className="relative">
                      <Input
                        id="reg-confirm"
                        type={showConfirm ? "text" : "password"}
                        required
                        value={regConfirm}
                        onChange={(e) => setRegConfirm(e.target.value)}
                        className={`pr-10 ${regConfirm && regConfirm !== regPassword ? "border-destructive" : ""}`}
                        dir="ltr"
                        placeholder="הזן סיסמה שנית"
                        autoComplete="new-password"
                        aria-invalid={!!(regConfirm && regConfirm !== regPassword)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showConfirm ? "הסתר אימות סיסמה" : "הצג אימות סיסמה"}
                      >
                        {showConfirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {regConfirm && regConfirm !== regPassword && (
                      <p role="alert" className="text-xs text-destructive">
                        הסיסמאות אינן תואמות
                      </p>
                    )}
                  </div>

                  {/* ── Checkboxes ───────────────────────────── */}
                  <div className="space-y-3 pt-1">
                    {/* 1. Terms — required */}
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => {
                          setAgreedToTerms(e.target.checked);
                          if (e.target.checked) setRegError("");
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-primary accent-primary cursor-pointer"
                      />
                      <span className="text-sm leading-snug">
                        אני מאשר/ת שקראתי את{" "}
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          תקנון האתר
                        </a>{" "}
                        ואני מסכים/ה לתנאיו{" "}
                        <span className="text-destructive font-bold">*</span>
                      </span>
                    </label>

                    {/* 2. Marketing — optional, checked by default */}
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={agreedToMarketing}
                        onChange={(e) => setAgreedToMarketing(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-primary accent-primary cursor-pointer"
                      />
                      <span className="text-sm leading-snug text-muted-foreground">
                        אני מסכים/ה לקבל הודעות שיווקיות במייל מ
                        <strong className="text-foreground">ביג-שווק</strong>{" "}
                        ולהישאר מעודכן/ת בקמפיינים, מבצעים וקופונים בלעדיים
                      </span>
                    </label>
                  </div>

                  {regError && (
                    <p role="alert" aria-live="assertive" className="text-sm text-destructive">{regError}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 text-lg font-bold mt-4"
                    disabled={regLoading || !agreedToTerms}
                  >
                    {regLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "שלח קוד אימות לאימייל"
                    )}
                  </Button>
                </form>
              )}

              {/* STEP 2: OTP */}
              {regStep === "otp" && (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <Mail className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold">בדוק את האימייל שלך</h3>
                    <p className="text-sm text-muted-foreground">
                      שלחנו קוד בן 6 ספרות לכתובת
                      <br />
                      <span className="font-medium text-foreground" dir="ltr">
                        {regEmail}
                      </span>
                    </p>
                  </div>

                  {devOtp && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                      <p className="text-xs text-amber-700 font-medium">
                        מצב פיתוח — קוד האימות:
                      </p>
                      <p className="text-2xl font-bold text-amber-800 tracking-widest mt-1">
                        {devOtp}
                      </p>
                    </div>
                  )}
                  <OtpInput value={otpValue} onChange={setOtpValue} />

                  {otpError && (
                    <p className="text-sm text-destructive text-center">
                      {otpError}
                    </p>
                  )}

                  <div className="flex items-center justify-center gap-2 text-sm">
                    <span className="text-muted-foreground">פג תוקף בעוד:</span>
                    {!otpExpired ? (
                      <Countdown
                        key={otpKey}
                        seconds={300}
                        onExpire={() => setOtpExpired(true)}
                      />
                    ) : (
                      <span className="text-destructive font-bold">
                        פג תוקף
                      </span>
                    )}
                  </div>

                  <Button
                    onClick={handleVerifyOtp}
                    className="w-full h-12 text-lg font-bold"
                    disabled={otpLoading || otpValue.length < 6 || otpExpired}
                  >
                    {otpLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "אמת ורשום"
                    )}
                  </Button>

                  <div className="text-center space-y-2">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={regLoading}
                      className="text-sm text-primary hover:underline disabled:opacity-50"
                    >
                      {regLoading ? "שולח..." : "שלח קוד מחדש"}
                    </button>
                    <br />
                    <button
                      type="button"
                      onClick={() => setRegStep("form")}
                      className="text-sm text-muted-foreground hover:underline"
                    >
                      חזרה לטופס
                    </button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── SUCCESS POPUP ── */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="max-w-sm text-center p-8 rounded-2xl">
          <DialogTitle className="sr-only">הרשמה הושלמה בהצלחה</DialogTitle>
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <Gift className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h2 className="text-2xl font-black mb-2">
            ברוך הבא, {successName}! 🎉
          </h2>
          {welcomePoints > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
              <p className="text-amber-800 font-bold text-lg">
                🎁 קיבלת {welcomePoints.toLocaleString("he-IL")} נקודות מתנה!
              </p>
              <p className="text-amber-600 text-sm mt-0.5">
                הנקודות כבר זמינות בחשבונך לשימוש בקנייה הבאה
              </p>
            </div>
          )}
          <p className="text-muted-foreground mb-6">
            ההרשמה הושלמה בהצלחה.
            <br />
            מוכן לגלות עסקאות מדהימות?
          </p>
          <Button
            className="w-full h-12 text-lg font-bold"
            onClick={() => {
              setShowSuccess(false);
              setLocation(redirectTo);
              window.location.reload();
            }}
          >
            התחל לחסוך! 🛒
          </Button>
        </DialogContent>
      </Dialog>

      <ForgotPasswordDialog open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </Layout>
  );
}
