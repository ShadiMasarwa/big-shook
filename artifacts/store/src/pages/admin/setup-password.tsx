import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";

export default function SetupManagerPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "שגיאה", description: "הסיסמה חייבת להיות לפחות 8 תווים", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "שגיאה", description: "הסיסמאות אינן תואמות", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/manager-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");
      localStorage.setItem("token", data.token);
      setDone(true);
      setTimeout(() => setLocation("/admin"), 2000);
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="bg-card border border-border rounded-2xl p-10 shadow-sm max-w-sm w-full text-center">
          <p className="text-destructive font-medium">קישור לא תקין</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="bg-card border border-border rounded-2xl p-10 shadow-sm max-w-sm w-full text-center space-y-3">
          <ShieldCheck className="h-12 w-12 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold">הסיסמה הוגדרה בהצלחה!</h2>
          <p className="text-muted-foreground text-sm">מועבר לממשק הניהול...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30" dir="rtl">
      <div className="bg-card border border-border rounded-2xl p-10 shadow-sm max-w-sm w-full mx-4">
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">הגדרת סיסמה</h1>
          <p className="text-muted-foreground text-sm text-center mt-1">
            בחר סיסמה לחשבון המנהל שלך
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>סיסמה חדשה</Label>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="לפחות 8 תווים"
                dir="ltr"
                className="pl-10"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>אימות סיסמה</Label>
            <Input
              type={showPass ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="הכנס שוב את הסיסמה"
              dir="ltr"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "מגדיר..." : "הגדר סיסמה וכנס לניהול"}
          </Button>
        </form>
      </div>
    </div>
  );
}
