import { useState } from "react";
import { Layout } from "@/components/layout";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateOrder } from "@workspace/api-client-react";
import { toast } from "@/components/ui/use-toast";
import { formatPrice } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Checkout() {
  const { cart, clearCart } = useCart();
  const { user } = useAuth();
  const createOrder = useCreateOrder();
  const [_, setLocation] = useLocation();

  const [step, setStep] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  const [shipping, setShipping] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    phone: "",
    city: "",
    street: "",
    houseNumber: "",
    zipCode: ""
  });

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handlePlaceOrder = async () => {
    try {
      const order = await createOrder.mutateAsync({
        data: {
          shippingAddress: shipping
        }
      });
      setOrderNumber(order.orderNumber);
      await clearCart();
      setIsSuccess(true);
    } catch (e) {
      toast({ title: "שגיאה ביצירת ההזמנה", variant: "destructive" });
    }
  };

  if (isSuccess) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 text-center max-w-md flex flex-col items-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-black mb-2">תודה על הזמנתך!</h1>
          <p className="text-lg text-muted-foreground mb-6">
            הזמנה מספר <span className="font-bold text-foreground">#{orderNumber}</span> התקבלה בהצלחה ותטופל בהקדם.
          </p>
          <div className="flex gap-4 w-full">
            <Button asChild className="flex-1">
              <Link href="/orders">ההזמנות שלי</Link>
            </Button>
            <Button variant="outline" asChild className="flex-1">
              <Link href="/">חזרה לדף הבית</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">אין פריטים לתשלום.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-muted py-8 mb-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold">קופה</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16 flex flex-col lg:flex-row gap-12">
        {/* Forms */}
        <div className="flex-1">
          {/* Step 1: Shipping */}
          <div className={`bg-card border ${step === 1 ? 'border-primary shadow-md' : 'border-border'} rounded-xl p-6 mb-6 transition-all`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step === 1 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>1</span>
                פרטי משלוח
              </h2>
              {step > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>ערוך</Button>
              )}
            </div>

            {step === 1 ? (
              <form onSubmit={handleNextStep} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>שם פרטי</Label>
                    <Input required value={shipping.firstName} onChange={(e) => setShipping({...shipping, firstName: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>שם משפחה</Label>
                    <Input required value={shipping.lastName} onChange={(e) => setShipping({...shipping, lastName: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>טלפון</Label>
                  <Input required type="tel" value={shipping.phone} onChange={(e) => setShipping({...shipping, phone: e.target.value})} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2 col-span-3 sm:col-span-1">
                    <Label>עיר</Label>
                    <Input required value={shipping.city} onChange={(e) => setShipping({...shipping, city: e.target.value})} />
                  </div>
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label>רחוב</Label>
                    <Input required value={shipping.street} onChange={(e) => setShipping({...shipping, street: e.target.value})} />
                  </div>
                  <div className="space-y-2 col-span-1">
                    <Label>מס' בית</Label>
                    <Input required value={shipping.houseNumber} onChange={(e) => setShipping({...shipping, houseNumber: e.target.value})} />
                  </div>
                </div>
                <Button type="submit" size="lg" className="w-full sm:w-auto mt-4 font-bold">המשך לתשלום</Button>
              </form>
            ) : (
              <div className="text-sm text-muted-foreground">
                {shipping.firstName} {shipping.lastName}<br/>
                {shipping.street} {shipping.houseNumber}, {shipping.city}<br/>
                טלפון: {shipping.phone}
              </div>
            )}
          </div>

          {/* Step 2: Payment */}
          <div className={`bg-card border ${step === 2 ? 'border-primary shadow-md' : 'border-border opacity-50'} rounded-xl p-6 transition-all`}>
            <h2 className="text-xl font-bold flex items-center gap-3 mb-6">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step === 2 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>2</span>
              אמצעי תשלום
            </h2>

            {step === 2 && (
              <div className="space-y-6">
                <div className="border border-primary bg-primary/5 rounded-lg p-4 flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-4 border-primary bg-white"></div>
                    <span className="font-bold">כרטיס אשראי</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-8 h-5 bg-muted rounded"></div>
                    <div className="w-8 h-5 bg-muted rounded"></div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>מספר כרטיס</Label>
                    <Input placeholder="0000 0000 0000 0000" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>תוקף</Label>
                      <Input placeholder="MM/YY" />
                    </div>
                    <div className="space-y-2">
                      <Label>CVV</Label>
                      <Input placeholder="123" />
                    </div>
                  </div>
                </div>

                <Button size="lg" className="w-full font-bold text-lg h-14" onClick={handlePlaceOrder}>
                  שלם {formatPrice(cart.total)} וסיים הזמנה
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Order Summary (Sidebar) */}
        <div className="w-full lg:w-96 shrink-0">
          <div className="bg-muted rounded-xl p-6 border border-border sticky top-24">
            <h2 className="font-bold mb-4 pb-4 border-b border-border">סיכום הזמנה</h2>
            
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
              {cart.items.map((item: any) => (
                <div key={item.productId} className="flex gap-3 text-sm">
                  <div className="w-12 h-12 bg-white rounded border border-border overflow-hidden shrink-0">
                    {item.product.images && item.product.images[0] && (
                      <img src={item.product.images[0]} alt="" className="w-full h-full object-contain p-1" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium line-clamp-1">{item.product.nameHe}</div>
                    <div className="text-muted-foreground flex justify-between mt-1">
                      <span>כמות: {item.quantity}</span>
                      <span className="font-bold text-foreground">{formatPrice(item.subtotal)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 text-sm border-t border-border pt-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">סכום ביניים</span>
                <span>{formatPrice(cart.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">משלוח</span>
                <span>{cart.shipping > 0 ? formatPrice(cart.shipping) : 'חינם'}</span>
              </div>
              {cart.couponDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>
                    הנחת קופון
                    {cart.couponCode && (
                      <code className="text-xs bg-green-100 text-green-700 px-1 rounded font-mono mr-1">{cart.couponCode}</code>
                    )}
                  </span>
                  <span>-{formatPrice(cart.couponDiscount)}</span>
                </div>
              )}
              {(cart as any).loyaltyDiscount > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>נקודות נאמנות ({(cart as any).loyaltyPointsUsed?.toLocaleString("he-IL")} נק׳)</span>
                  <span>-{formatPrice((cart as any).loyaltyDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-lg pt-2 border-t border-border">
                <span>סה"כ</span>
                <span className="text-primary">{formatPrice(cart.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
