import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useSupplier, useCreateSupplier, useUpdateSupplier } from "@/hooks/use-suppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

const EMPTY_FORM = {
  companyName: "",
  contactPerson: "",
  taxId: "",
  phone1: "",
  phone2: "",
  address: "",
  city: "",
  email: "",
  website: "",
  notes: "",
  isActive: true,
};

export default function AdminSupplierForm() {
  const { id } = useParams();
  const isEditing = !!id && id !== "new";
  const supplierId = Number(id);
  const [, setLocation] = useLocation();

  const { data: supplier, isLoading } = useSupplier(supplierId);
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();

  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (supplier && isEditing) {
      setForm({
        companyName: supplier.companyName,
        contactPerson: supplier.contactPerson || "",
        taxId: supplier.taxId || "",
        phone1: supplier.phone1 || "",
        phone2: supplier.phone2 || "",
        address: supplier.address || "",
        city: supplier.city || "",
        email: supplier.email || "",
        website: supplier.website || "",
        notes: supplier.notes || "",
        isActive: supplier.isActive,
      });
    }
  }, [supplier, isEditing]);

  const field = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) {
      toast({ title: "שם חברה הוא שדה חובה", variant: "destructive" });
      return;
    }
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: supplierId, data: form });
        toast({ title: "הספק עודכן בהצלחה" });
      } else {
        await createMutation.mutateAsync(form);
        toast({ title: "הספק נוצר בהצלחה" });
      }
      setLocation("/admin/suppliers");
    } catch {
      toast({ title: "שגיאה בשמירת הספק", variant: "destructive" });
    }
  };

  if (isEditing && isLoading) return <AdminLayout><div className="p-8">טוען...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{isEditing ? "עריכת ספק" : "ספק חדש"}</h1>
        <Button variant="outline" onClick={() => setLocation("/admin/suppliers")}>חזור לרשימה</Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader><CardTitle>פרטי חברה</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2 md:col-span-2">
                <Label>שם חברה *</Label>
                <Input required {...field("companyName")} placeholder="לדוגמה: טק דיסטריביושן בע&quot;מ" />
              </div>
              <div className="space-y-2">
                <Label>איש קשר</Label>
                <Input {...field("contactPerson")} placeholder="שם מנהל / נציג" />
              </div>
              <div className="space-y-2">
                <Label>ח.פ / עוסק מורשה</Label>
                <Input dir="ltr" {...field("taxId")} placeholder="123456789" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>פרטי קשר</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label>טלפון ראשי</Label>
                <Input dir="ltr" type="tel" {...field("phone1")} placeholder="03-1234567" />
              </div>
              <div className="space-y-2">
                <Label>טלפון נוסף</Label>
                <Input dir="ltr" type="tel" {...field("phone2")} placeholder="050-1234567" />
              </div>
              <div className="space-y-2">
                <Label>אימייל</Label>
                <Input dir="ltr" type="email" {...field("email")} placeholder="info@supplier.co.il" />
              </div>
              <div className="space-y-2">
                <Label>אתר אינטרנט</Label>
                <Input dir="ltr" {...field("website")} placeholder="www.supplier.co.il" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>כתובת</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2 md:col-span-2">
                <Label>כתובת</Label>
                <Input {...field("address")} placeholder="רחוב ומספר" />
              </div>
              <div className="space-y-2">
                <Label>עיר</Label>
                <Input {...field("city")} placeholder="תל אביב" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>הגדרות נוספות</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>הערות פנימיות</Label>
              <Textarea
                className="h-24"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="הערות לשימוש פנימי..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                checked={form.isActive}
                onCheckedChange={c => setForm(f => ({ ...f, isActive: !!c }))}
              />
              <Label htmlFor="isActive" className="cursor-pointer">ספק פעיל</Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 pb-8">
          <Button type="submit" size="lg" className="px-10 font-bold" disabled={createMutation.isPending || updateMutation.isPending}>
            {(createMutation.isPending || updateMutation.isPending) ? "שומר..." : isEditing ? "שמור שינויים" : "צור ספק"}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => setLocation("/admin/suppliers")}>ביטול</Button>
        </div>
      </form>
    </AdminLayout>
  );
}
