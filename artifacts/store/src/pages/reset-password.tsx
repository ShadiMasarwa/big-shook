import { useState } from "react";
import { useSearch, useLocation } from "wouter";
import { Lock, Eye, EyeOff, Check, X, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PWD_RULES = [
  { id: "len",     label: "לפחות 8 תווים",               test: (p: string) => p.length >= 8 },
  { id: "upper",   label: "אות גדולה באנגלית (A-Z)",      test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower",   label: "אות קטנה באנגלית (a-z)",      test: (p: string) => /[a-z]/.test(p) },
  { id: "digit",   label: "לפחות ספרה אחת (0-9)",         test: (p: string) => /[0-9]/.test(p) },
  { id: "special", label: "תו מיוחד (!@#$%...)",          test: (p: string) => /[^A-Za-z0-9]/.test(p) },
  { id: "eng",     label: "אנגלית בלבד (ללא עברית)",      test: (p: string) => !/[\u0590-\u05FF]/.test(p) },
];

export default function ResetPassword() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") ?? "";

  const [, navigate] = useLocation();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const allRulesPass = PWD_RULES.every((r) => r.test(password));
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("קישור לא תקין");
      return;
    }
    if (!allRulesPass) {
      setError("הסיסמה אינה עומדת בדרישות");
      return;
    }
    if (!passwordsMatch) {
      setError("הסיסמאות אינן תואמות");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "שגיאה באיפוס הסיסמה");
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate("/auth"), 3000);
    } catch {
      setError("שגיאת תקשורת. אנא נסה שוב.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center px-4" dir="rtl">
          <div className="text-center max-w-sm">
            <p className="text-destructive text-lg font-semibold mb-4">קישור לא תקין</p>
            <p className="text-muted-foreground mb-6">הקישור שהגעת דרכו אינו תקין.</p>
            <Button onClick={() => navigate("/auth")}>חזרה להתחברות</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-[calc(100vh-400px)] flex items-center justify-center py-16 px-4">
        <div
          className="w-full max-w-md bg-card border border-border shadow-lg rounded-2xl p-8"
          dir="rtl"
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Lock className="h-8 w-8" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">איפוס סיסמה</h1>
          <p className="text-muted-foreground text-center text-sm mb-8">
            בחר סיסמה חדשה לחשבון שלך
          </p>

          {success ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                  <ShieldCheck className="h-8 w-8" />
                </div>
              </div>
              <p className="text-green-700 font-semibold text-lg">הסיסמה שונתה בהצלחה!</p>
              <p className="text-muted-foreground text-sm">מעביר אותך לדף ההתחברות...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-label="טופס איפוס סיסמה">
              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="reset-password">סיסמה חדשה</Label>
                <div className="relative">
                  <Input
                    id="reset-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="הזן סיסמה חדשה"
                    autoComplete="new-password"
                    aria-required="true"
                    className="pl-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Password rules */}
              {password.length > 0 && (
                <div
                  className="grid grid-cols-2 gap-1 text-xs"
                  aria-live="polite"
                  aria-label="דרישות סיסמה"
                >
                  {PWD_RULES.map((r) => {
                    const ok = r.test(password);
                    return (
                      <div
                        key={r.id}
                        className={`flex items-center gap-1 ${ok ? "text-green-600" : "text-muted-foreground"}`}
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
              )}

              {/* Confirm password */}
              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password">אימות סיסמה</Label>
                <div className="relative">
                  <Input
                    id="reset-confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="הזן שוב את הסיסמה"
                    autoComplete="new-password"
                    aria-required="true"
                    aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                    className="pl-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "הסתר אימות סיסמה" : "הצג אימות סיסמה"}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-destructive" role="alert">
                    הסיסמאות אינן תואמות
                  </p>
                )}
                {confirmPassword.length > 0 && passwordsMatch && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" /> הסיסמאות תואמות
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-destructive text-center" role="alert" aria-live="assertive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-base"
                disabled={loading || !allRulesPass || !passwordsMatch}
              >
                {loading ? "מאפס..." : "שמור סיסמה חדשה"}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate("/auth")}
                  className="text-sm text-muted-foreground hover:text-primary underline"
                >
                  חזרה להתחברות
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}
