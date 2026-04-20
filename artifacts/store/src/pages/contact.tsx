import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MapPin } from "lucide-react";

const DEPARTMENTS = [
  { value: "customer_service", label: "שירות לקוחות" },
  { value: "info", label: "בקשת מידע" },
  { value: "suppliers", label: "ספקים" },
  { value: "admin", label: "הנהלה" },
];

export default function Contact() {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("customer_service");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState(""); // honeypot
  const [captcha, setCaptcha] = useState(false);
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setA(Math.floor(Math.random() * 9) + 1);
    setB(Math.floor(Math.random() * 9) + 1);
  }, []);

  const captchaPasses = captcha && parseInt(answer || "-1", 10) === a + b;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!captchaPasses) {
      toast({ title: "יש להשלים את אימות ה-CAPTCHA", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName, email, department, message, captcha: true, hp,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "שליחה נכשלה");
      }
      setSuccess(true);
      toast({
        title: "פנייתך נשלחה בהצלחה",
        description: "פנייתך התקבלה ותטופל תוך 3 ימי עסקים.",
      });
      setFullName(""); setEmail(""); setMessage(""); setAnswer(""); setCaptcha(false);
    } catch (err: any) {
      toast({ title: err.message ?? "שליחה נכשלה", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <h1 className="text-3xl font-black mb-2">צור קשר</h1>
        <p className="text-muted-foreground mb-8">נשמח לשמוע ממך — מלא את הטופס ונחזור אליך בהקדם.</p>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm">
            {success ? (
              <div className="text-center py-12">
                <div className="h-16 w-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <Mail className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2">פנייתך נשלחה בהצלחה!</h2>
                <p className="text-muted-foreground mb-6">פנייתך התקבלה ותטופל תוך 3 ימי עסקים.</p>
                <Button onClick={() => setSuccess(false)} variant="outline">שלח פנייה נוספת</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Honeypot — hidden from real users */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={hp}
                  onChange={(e) => setHp(e.target.value)}
                  className="hidden"
                  aria-hidden="true"
                />

                <div>
                  <Label htmlFor="fullName">שם מלא *</Label>
                  <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} data-testid="input-contact-name" />
                </div>

                <div>
                  <Label htmlFor="email">כתובת אימייל *</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-contact-email" />
                </div>

                <div>
                  <Label htmlFor="department">מחלקה *</Label>
                  <select
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    data-testid="select-contact-department"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center">
                    <Label htmlFor="message">תוכן ההודעה *</Label>
                    <span className={`text-xs ${message.length > 200 ? "text-destructive" : "text-muted-foreground"}`}>
                      {message.length} / 200
                    </span>
                  </div>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    maxLength={200}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full p-3 rounded-md border border-input bg-background text-sm resize-y"
                    data-testid="textarea-contact-message"
                  />
                </div>

                <div className="border border-border rounded-lg p-4 bg-muted/40 space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="captcha"
                      checked={captcha}
                      onCheckedChange={(v) => setCaptcha(!!v)}
                      data-testid="checkbox-captcha"
                    />
                    <Label htmlFor="captcha" className="cursor-pointer font-medium">אני לא רובוט</Label>
                  </div>
                  {captcha && (
                    <div className="flex items-center gap-2 text-sm">
                      <span>פתור: {a} + {b} =</span>
                      <Input
                        type="number"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        className="w-20"
                        data-testid="input-captcha-answer"
                      />
                      {parseInt(answer || "-1", 10) === a + b && (
                        <span className="text-green-600 font-medium">✓ אומת</span>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={submitting || !captchaPasses || message.length === 0}
                  className="w-full"
                  data-testid="btn-contact-submit"
                >
                  {submitting ? "שולח..." : "שליחת הפנייה"}
                </Button>
              </form>
            )}
          </div>

          <aside className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold mb-4">פרטי התקשרות</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> 051-5008661</li>
                <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> support@bigshook.com</li>
                <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> ת.ד. 3869, טייבה 4040000</li>
              </ul>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm text-sm text-muted-foreground">
              <h3 className="font-bold text-foreground mb-2">שעות פעילות</h3>
              <p>א'-ה' 9:00 — 18:00<br />ו' 9:00 — 13:00</p>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
