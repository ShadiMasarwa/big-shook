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
    <div className="flex justify-center">
      <div className="relative" style={{ width: 318, height: 56 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[i] ?? ""}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={handlePaste}
            style={{ position: "absolute", left: i * 54, top: 0, width: 48, height: 56 }}
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

// ── Main component ────────────────────────────────────────────────────────────
export default function Auth() {
  const { login, user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("login");

  // Read ?redirect= param so we can bounce back after login/register
  const redirectTo = (() => {
    try {
      const r = new URLSearchParams(window.location.search).get("redirect") ?? "";
      // Only allow relative paths that start with /
      return r.startsWith("/") && !r.startsWith("//") ? r : "/";
    } catch { return "/"; }
  })();

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginShowPwd, setLoginShowPwd] = useState(false);
  const [loginError, setLoginError] = useState("");
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
    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error ?? "שגיאה בהתחברות");
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
              <form onSubmit={handleLogin} className="space-y-4" dir="rtl">
                <div className="space-y-2">
                  <Label>אימייל</Label>
                  <Input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>סיסמה</Label>
                  <div className="relative">
                    <Input
                      type={loginShowPwd ? "text" : "password"}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pr-10"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setLoginShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {loginShowPwd ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                {loginError && (
                  <p className="text-sm text-destructive">{loginError}</p>
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
                <form onSubmit={handleSendOtp} className="space-y-4" dir="rtl">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>שם פרטי *</Label>
                      <Input
                        required
                        value={regFirstName}
                        onChange={(e) => setRegFirstName(e.target.value)}
                        placeholder="ישראל"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>שם משפחה *</Label>
                      <Input
                        required
                        value={regLastName}
                        onChange={(e) => setRegLastName(e.target.value)}
                        placeholder="ישראלי"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>אימייל *</Label>
                    <Input
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
                      className={
                        regEmailError
                          ? "border-destructive focus-visible:ring-destructive"
                          : ""
                      }
                    />
                    {regEmailError && (
                      <p className="text-xs text-destructive">
                        {regEmailError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>טלפון *</Label>
                    <Input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="050-0000000"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>סיסמה *</Label>
                    <div className="relative">
                      <Input
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
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPwd ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {pwdRulesList}
                  </div>

                  <div className="space-y-2">
                    <Label>אימות סיסמה *</Label>
                    <div className="relative">
                      <Input
                        type={showConfirm ? "text" : "password"}
                        required
                        value={regConfirm}
                        onChange={(e) => setRegConfirm(e.target.value)}
                        className={`pr-10 ${regConfirm && regConfirm !== regPassword ? "border-destructive" : ""}`}
                        dir="ltr"
                        placeholder="הזן סיסמה שנית"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {regConfirm && regConfirm !== regPassword && (
                      <p className="text-xs text-destructive">
                        הסיסמאות אינן תואמות
                      </p>
                    )}
                  </div>

                  {regError && (
                    <p className="text-sm text-destructive">{regError}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 text-lg font-bold mt-4"
                    disabled={regLoading}
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
    </Layout>
  );
}
