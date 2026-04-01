import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useSuppliers, useDeleteSupplier, Supplier } from "@/hooks/use-suppliers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { Plus, Eye, Edit, Trash2, Phone, Mail, MapPin, Building2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function SupplierCard({ supplier, onDelete }: { supplier: Supplier; onDelete: (id: number) => void }) {
  const [showDetail, setShowDetail] = useState(false);
  const [, navigate] = useLocation();

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <h3 className="font-bold text-lg leading-tight truncate">{supplier.companyName}</h3>
                {!supplier.isActive && <Badge variant="secondary" className="text-xs">לא פעיל</Badge>}
              </div>
              {supplier.contactPerson && (
                <p className="text-sm text-muted-foreground mb-2">איש קשר: {supplier.contactPerson}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {supplier.phone1 && (
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{supplier.phone1}</span>
                )}
                {supplier.email && (
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{supplier.email}</span>
                )}
                {supplier.city && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{supplier.city}</span>
                )}
              </div>
              {supplier.taxId && (
                <p className="text-xs text-muted-foreground mt-1">ח.פ / עוסק: {supplier.taxId}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button size="sm" variant="default" onClick={() => setShowDetail(true)}>
                <Eye className="h-4 w-4 ml-1" />הצג
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`/admin/suppliers/${supplier.id}/edit`)}>
                <Edit className="h-4 w-4 ml-1" />ערוך
              </Button>
              <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive hover:text-white" onClick={() => onDelete(supplier.id)}>
                <Trash2 className="h-4 w-4 ml-1" />מחק
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Building2 className="h-5 w-5 text-primary" />
              {supplier.companyName}
            </DialogTitle>
            <DialogDescription>פרטי ספק</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {supplier.contactPerson && (
              <div className="flex justify-between border-b border-border pb-2">
                <span className="font-medium text-muted-foreground">איש קשר</span>
                <span>{supplier.contactPerson}</span>
              </div>
            )}
            {supplier.taxId && (
              <div className="flex justify-between border-b border-border pb-2">
                <span className="font-medium text-muted-foreground">ח.פ / עוסק מורשה</span>
                <span dir="ltr">{supplier.taxId}</span>
              </div>
            )}
            {supplier.phone1 && (
              <div className="flex justify-between border-b border-border pb-2">
                <span className="font-medium text-muted-foreground">טלפון ראשי</span>
                <span dir="ltr">{supplier.phone1}</span>
              </div>
            )}
            {supplier.phone2 && (
              <div className="flex justify-between border-b border-border pb-2">
                <span className="font-medium text-muted-foreground">טלפון נוסף</span>
                <span dir="ltr">{supplier.phone2}</span>
              </div>
            )}
            {supplier.email && (
              <div className="flex justify-between border-b border-border pb-2">
                <span className="font-medium text-muted-foreground">אימייל</span>
                <a href={`mailto:${supplier.email}`} className="text-primary hover:underline" dir="ltr">{supplier.email}</a>
              </div>
            )}
            {supplier.website && (
              <div className="flex justify-between border-b border-border pb-2">
                <span className="font-medium text-muted-foreground">אתר אינטרנט</span>
                <a href={supplier.website.startsWith("http") ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noreferrer" className="text-primary hover:underline" dir="ltr">{supplier.website}</a>
              </div>
            )}
            {(supplier.address || supplier.city) && (
              <div className="flex justify-between border-b border-border pb-2">
                <span className="font-medium text-muted-foreground">כתובת</span>
                <span>{[supplier.address, supplier.city].filter(Boolean).join(", ")}</span>
              </div>
            )}
            {supplier.notes && (
              <div className="border-b border-border pb-2">
                <p className="font-medium text-muted-foreground mb-1">הערות</p>
                <p className="text-sm">{supplier.notes}</p>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-medium text-muted-foreground">סטטוס</span>
              <Badge variant={supplier.isActive ? "default" : "secondary"}>
                {supplier.isActive ? "פעיל" : "לא פעיל"}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => { setShowDetail(false); navigate(`/admin/suppliers/${supplier.id}/edit`); }} className="flex-1">
              <Edit className="h-4 w-4 ml-1" />ערוך ספק
            </Button>
            <Button variant="outline" asChild className="flex-1">
              <Link href={`/admin/suppliers/${supplier.id}`}>מוצרי הספק</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminSuppliers() {
  const { data: suppliers, isLoading } = useSuppliers();
  const deleteSupplier = useDeleteSupplier();

  const handleDelete = async (id: number) => {
    if (window.confirm("האם אתה בטוח שברצונך למחוק ספק זה? כל המוצרים שלו יהפכו ללא-מקושרים.")) {
      try {
        await deleteSupplier.mutateAsync(id);
        toast({ title: "הספק נמחק בהצלחה" });
      } catch {
        toast({ title: "שגיאה במחיקת הספק", variant: "destructive" });
      }
    }
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">ניהול ספקים</h1>
          <p className="text-muted-foreground mt-1">{suppliers?.length ?? 0} ספקים במערכת</p>
        </div>
        <Button asChild>
          <Link href="/admin/suppliers/new"><Plus className="ml-2 h-4 w-4" />ספק חדש</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))
        ) : suppliers?.length === 0 ? (
          <div className="col-span-2 text-center py-16 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">אין ספקים עדיין</p>
            <Button asChild className="mt-4"><Link href="/admin/suppliers/new">הוסף ספק ראשון</Link></Button>
          </div>
        ) : (
          suppliers?.map(s => (
            <SupplierCard key={s.id} supplier={s} onDelete={handleDelete} />
          ))
        )}
      </div>
    </AdminLayout>
  );
}
