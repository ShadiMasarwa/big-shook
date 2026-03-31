import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Star, Gift, Crown, Trophy, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Loyalty() {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();

  if (!user) {
    setLocation("/auth");
    return null;
  }

  const tiers = [
    { id: "bronze", name: "ארד", min: 0, color: "text-amber-700", bg: "bg-amber-100", icon: Star },
    { id: "silver", name: "כסף", min: 1000, color: "text-slate-400", bg: "bg-slate-100", icon: Gift },
    { id: "gold", name: "זהב", min: 5000, color: "text-yellow-500", bg: "bg-yellow-100", icon: Trophy },
    { id: "vip", name: "VIP", min: 15000, color: "text-purple-600", bg: "bg-purple-100", icon: Crown },
  ];

  const currentTierIndex = tiers.findIndex(t => t.id === user.loyaltyTier) || 0;
  const currentTier = tiers[currentTierIndex];
  const nextTier = tiers[currentTierIndex + 1];

  const progressToNext = nextTier 
    ? Math.min(100, Math.max(0, (user.loyaltyPoints / nextTier.min) * 100))
    : 100;

  return (
    <Layout>
      <div className="bg-gradient-to-l from-primary/90 to-primary text-primary-foreground py-16">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center gap-8 justify-between">
          <div>
            <h1 className="text-4xl font-black mb-4">מועדון הלקוחות שלי</h1>
            <p className="text-primary-foreground/80 text-lg max-w-lg">
              ברוכים הבאים לאזור האישי. כאן תוכלו לראות את הנקודות שלכם, הדרגה הנוכחית וההטבות שמגיעות לכם.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 text-center min-w-[300px]">
            <div className="text-sm font-medium mb-2 opacity-80">סך הנקודות שלך</div>
            <div className="text-6xl font-black mb-4">{user.loyaltyPoints}</div>
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-bold bg-white text-foreground`}>
              <currentTier.icon className={`h-5 w-5 ${currentTier.color}`} />
              דרגת {currentTier.name}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        {nextTier && (
          <div className="bg-card border border-border rounded-xl p-8 mb-12 shadow-sm max-w-3xl mx-auto">
            <h3 className="font-bold text-lg mb-6 text-center">ההתקדמות לדרגת {nextTier.name}</h3>
            <div className="relative h-4 bg-muted rounded-full overflow-hidden mb-4">
              <div 
                className="absolute top-0 right-0 h-full bg-primary rounded-full transition-all duration-1000"
                style={{ width: `${progressToNext}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-sm font-medium text-muted-foreground">
              <span>{user.loyaltyPoints} נק'</span>
              <span>{nextTier.min} נק'</span>
            </div>
            <p className="text-center mt-4 text-sm">
              חסרות לך עוד <span className="font-bold text-foreground">{nextTier.min - user.loyaltyPoints}</span> נקודות לשדרוג לדרגת {nextTier.name} וקבלת הטבות חדשות!
            </p>
          </div>
        )}

        <h2 className="text-2xl font-bold mb-8 text-center">הדרגות וההטבות שלנו</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier, idx) => {
            const isCurrent = user.loyaltyTier === tier.id;
            return (
              <div 
                key={tier.id} 
                className={`relative bg-card rounded-2xl p-6 border-2 transition-all ${isCurrent ? 'border-primary shadow-md scale-105 z-10' : 'border-border'}`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                    הדרגה שלך
                  </div>
                )}
                <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${tier.bg} ${tier.color}`}>
                  <tier.icon className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-black text-center mb-1">{tier.name}</h3>
                <p className="text-sm text-center text-muted-foreground mb-6">
                  {idx === 0 ? 'עם ההרשמה' : `מ-${tier.min} נקודות`}
                </p>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    {idx === 0 ? 'נקודה לכל ₪10' : idx === 1 ? 'נקודה וחצי לכל ₪10' : idx === 2 ? '2 נקודות לכל ₪10' : '3 נקודות לכל ₪10'}
                  </li>
                  {idx >= 1 && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" /> משלוח חינם {idx === 1 ? 'מעל ₪199' : 'ללא מינימום'}
                    </li>
                  )}
                  {idx >= 2 && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" /> מתנת יום הולדת
                    </li>
                  )}
                  {idx === 3 && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" /> שירות לקוחות VIP אישי
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
