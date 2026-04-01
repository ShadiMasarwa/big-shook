import { useParams, useLocation, Link } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useSupplier, useSupplierProducts } from "@/hooks/use-suppliers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/utils";
import { Edit, Phone, Mail, Globe, MapPin, FileText, User, Hash, CheckCircle, XCircle, Plus } from "lucide-react";

function InfoRow({ label, value, ltr }: { label: string; value?: string | null; ltr?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start py-3 border-b border-border last:border-0">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className={`text-right max-w-[60%]${ltr ? " font-mono" : ""}`} dir={ltr ? "ltr" : undefined}>{value}</span>
    </div>
  );
}

export default function AdminSupplierDetail() {
  const { id } = useParams();
  const supplierId = Number(id);
  const [, navigate] = useLocation();

  const { data: supplier, isLoading: loadingSupplier } = useSupplier(supplierId);
  const { data: products, isLoading: loadingProducts } = useSupplierProducts(supplierId);

  if (loadingSupplier) return <AdminLayout><div className="p-8">טוען...</div></AdminLayout>;
  if (!supplier) return <AdminLayout><div className="p-8 text-muted-foreground">ספק לא נמצא</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">{supplier.companyName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={supplier.isActive ? "default" : "secondary"}>
              {supplier.isActive ? "ספק פעיל" : "לא פעיל"}
            </Badge>
            {supplier.contactPerson && (
              <span className="text-muted-foreground text-sm flex items-center gap-1">
                <User className="h-3 w-3" />{supplier.contactPerson}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/suppliers")}>חזור לרשימה</Button>
          <Button onClick={() => navigate(`/admin/suppliers/${supplierId}/edit`)}>
            <Edit className="ml-2 h-4 w-4" />ערוך ספק
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">פרטי חברה</CardTitle></CardHeader>
            <CardContent className="pt-0 text-sm">
              <InfoRow label="ח.פ / עוסק" value={supplier.taxId} ltr />
              <InfoRow label="איש קשר" value={supplier.contactPerson} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Phone className="h-4 w-4" />פרטי קשר</CardTitle></CardHeader>
            <CardContent className="pt-0 text-sm">
              {supplier.phone1 && (
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-muted-foreground">טלפון ראשי</span>
                  <a href={`tel:${supplier.phone1}`} className="text-primary hover:underline" dir="ltr">{supplier.phone1}</a>
                </div>
              )}
              {supplier.phone2 && (
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-muted-foreground">טלפון נוסף</span>
                  <a href={`tel:${supplier.phone2}`} className="text-primary hover:underline" dir="ltr">{supplier.phone2}</a>
                </div>
              )}
              {supplier.email && (
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />אימייל</span>
                  <a href={`mailto:${supplier.email}`} className="text-primary hover:underline text-xs" dir="ltr">{supplier.email}</a>
                </div>
              )}
              {supplier.website && (
                <div className="flex justify-between items-center py-3">
                  <span className="text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" />אתר</span>
                  <a href={supplier.website.startsWith("http") ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs" dir="ltr">{supplier.website}</a>
                </div>
              )}
            </CardContent>
          </Card>

          {(supplier.address || supplier.city) && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" />כתובת</CardTitle></CardHeader>
              <CardContent className="pt-0 text-sm">
                <p>{[supplier.address, supplier.city].filter(Boolean).join(", ")}</p>
              </CardContent>
            </Card>
          )}

          {supplier.notes && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />הערות</CardTitle></CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground">{supplier.notes}</CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>מוצרים של ספק זה ({products?.length ?? 0})</CardTitle>
                <Button size="sm" asChild variant="outline">
                  <Link href="/admin/products/new">
                    <Plus className="h-4 w-4 ml-1" />הוסף מוצר
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingProducts ? (
                <div className="p-6 space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : products?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Hash className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>אין מוצרים לספק זה</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">תמונה</TableHead>
                      <TableHead className="text-right">שם מוצר</TableHead>
                      <TableHead className="text-center">מק"ט</TableHead>
                      <TableHead className="text-center">מחיר</TableHead>
                      <TableHead className="text-center">מלאי</TableHead>
                      <TableHead className="text-center">פעיל</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products?.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="w-10 h-10 bg-white rounded border border-border overflow-hidden flex items-center justify-center">
                            {p.images[0] ? (
                              <img src={p.images[0]} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-[9px] text-muted-foreground">אין</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{p.nameHe}</TableCell>
                        <TableCell className="text-center">{p.sku || "-"}</TableCell>
                        <TableCell className="text-center">{formatPrice(p.price)}</TableCell>
                        <TableCell className="text-center font-bold">{p.stockQuantity}</TableCell>
                        <TableCell className="text-center">
                          {p.isActive ? <CheckCircle className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/admin/products/${p.id}/edit`}>ערוך</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
