import { AdminLayout } from "@/components/admin-layout";
import { 
  useGetProduct, 
  useCreateProduct, 
  useUpdateProduct, 
  useListCategories, 
  useListBrands,
  getGetProductQueryKey
} from "@workspace/api-client-react";
import { useSuppliers } from "@/hooks/use-suppliers";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { X, Plus } from "lucide-react";

export default function AdminProductForm() {
  const { id } = useParams();
  const isEditing = !!id && id !== "new";
  const productId = Number(id);
  const [_, setLocation] = useLocation();

  const { data: categories } = useListCategories();
  const { data: brands } = useListBrands();
  const { data: suppliers } = useSuppliers();
  
  const { data: product, isLoading: isLoadingProduct } = useGetProduct(productId, {
    query: { enabled: isEditing, queryKey: getGetProductQueryKey(productId) }
  });

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();

  const [formData, setFormData] = useState({
    nameHe: "",
    nameEn: "",
    slug: "",
    descriptionHe: "",
    sku: "",
    price: 0,
    salePrice: 0,
    stockQuantity: 0,
    categoryId: "",
    brandId: "",
    supplierId: "",
    isActive: true,
    isFeatured: false,
    images: "",
  });

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [specs, setSpecs] = useState<{ key: string; value: string }[]>([]);
  const [specKey, setSpecKey] = useState("");
  const [specValue, setSpecValue] = useState("");

  useEffect(() => {
    if (product && isEditing) {
      setFormData({
        nameHe: product.nameHe,
        nameEn: product.nameEn || "",
        slug: product.slug,
        descriptionHe: product.descriptionHe || "",
        sku: product.sku || "",
        price: product.price,
        salePrice: product.salePrice || 0,
        stockQuantity: product.stockQuantity,
        categoryId: product.categoryId?.toString() || "",
        brandId: product.brandId?.toString() || "",
        supplierId: (product as any).supplierId?.toString() || "",
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        images: product.images.join("\n"),
      });
      setTags(product.tags || []);
      const specsObj = product.specs as Record<string, string> || {};
      setSpecs(Object.entries(specsObj).map(([key, value]) => ({ key, value: String(value) })));
    }
  }, [product, isEditing]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag));

  const addSpec = () => {
    if (specKey.trim() && specValue.trim()) {
      const existing = specs.findIndex(s => s.key === specKey.trim());
      if (existing >= 0) {
        const updated = [...specs];
        updated[existing] = { key: specKey.trim(), value: specValue.trim() };
        setSpecs(updated);
      } else {
        setSpecs([...specs, { key: specKey.trim(), value: specValue.trim() }]);
      }
      setSpecKey("");
      setSpecValue("");
    }
  };

  const removeSpec = (key: string) => setSpecs(specs.filter(s => s.key !== key));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const specsObj: Record<string, string> = {};
    specs.forEach(s => { specsObj[s.key] = s.value; });

    const payload = {
      nameHe: formData.nameHe,
      nameEn: formData.nameEn || null,
      slug: formData.slug || formData.nameHe.replace(/\s+/g, '-').toLowerCase(),
      descriptionHe: formData.descriptionHe || null,
      sku: formData.sku || null,
      price: Number(formData.price),
      salePrice: Number(formData.salePrice) > 0 ? Number(formData.salePrice) : null,
      stockQuantity: Number(formData.stockQuantity),
      categoryId: formData.categoryId ? Number(formData.categoryId) : null,
      brandId: formData.brandId ? Number(formData.brandId) : null,
      supplierId: formData.supplierId ? Number(formData.supplierId) : null,
      isActive: formData.isActive,
      isFeatured: formData.isFeatured,
      images: formData.images.split("\n").map(s => s.trim()).filter(Boolean),
      tags,
      specs: specsObj,
    };

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: productId, data: payload });
        toast({ title: "המוצר עודכן בהצלחה" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: "המוצר נוצר בהצלחה" });
      }
      setLocation("/admin/products");
    } catch (err) {
      toast({ title: "שגיאה בשמירת המוצר", variant: "destructive" });
    }
  };

  if (isEditing && isLoadingProduct) return <AdminLayout><div className="p-8">טוען...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{isEditing ? "עריכת מוצר" : "מוצר חדש"}</h1>
        <Button variant="outline" onClick={() => setLocation("/admin/products")}>חזור לרשימה</Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
        <Card>
          <CardHeader><CardTitle>פרטים בסיסיים</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>שם מוצר (עברית) *</Label>
                <Input required value={formData.nameHe} onChange={e => setFormData({...formData, nameHe: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>שם מוצר (אנגלית)</Label>
                <Input value={formData.nameEn} onChange={e => setFormData({...formData, nameEn: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>מזהה URL (Slug)</Label>
                <Input dir="ltr" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="auto-generated-if-empty" />
              </div>
              <div className="space-y-2">
                <Label>מק"ט (SKU)</Label>
                <Input dir="ltr" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>קטגוריה</Label>
                <Select value={formData.categoryId} onValueChange={v => setFormData({...formData, categoryId: v})}>
                  <SelectTrigger><SelectValue placeholder="בחר קטגוריה" /></SelectTrigger>
                  <SelectContent>
                    {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.nameHe}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>מותג</Label>
                <Select value={formData.brandId} onValueChange={v => setFormData({...formData, brandId: v})}>
                  <SelectTrigger><SelectValue placeholder="בחר מותג" /></SelectTrigger>
                  <SelectContent>
                    {brands?.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.nameHe}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ספק</Label>
                <Select value={formData.supplierId} onValueChange={v => setFormData({...formData, supplierId: v})}>
                  <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                  <SelectContent>
                    {suppliers?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>תיאור המוצר</Label>
                <Textarea className="h-28" value={formData.descriptionHe} onChange={e => setFormData({...formData, descriptionHe: e.target.value})} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>מחיר ומלאי</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>מחיר רגיל (₪) *</Label>
                <Input type="number" required min="0" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <Label>מחיר מבצע (₪)</Label>
                <Input type="number" min="0" step="0.01" value={formData.salePrice || ""} placeholder="ריק = אין מבצע" onChange={e => setFormData({...formData, salePrice: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <Label>כמות במלאי *</Label>
                <Input type="number" required min="0" value={formData.stockQuantity} onChange={e => setFormData({...formData, stockQuantity: Number(e.target.value)})} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>תמונות</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>קישורים לתמונות (כל תמונה בשורה נפרדת)</Label>
              <Textarea className="h-28 font-mono text-sm" dir="ltr" placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg" value={formData.images} onChange={e => setFormData({...formData, images: e.target.value})} />
              {formData.images && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.images.split("\n").filter(Boolean).map((url, i) => (
                    <img key={i} src={url.trim()} alt="" className="h-16 w-16 object-contain rounded border border-border bg-white" onError={e => (e.currentTarget.style.display = 'none')} />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>תגיות</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="gap-1 text-sm pl-1">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-muted-foreground hover:text-foreground ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input 
                dir="ltr"
                placeholder="הוסף תגית (לחץ Enter)"
                value={tagInput} 
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              />
              <Button type="button" variant="outline" onClick={addTag}><Plus className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>מפרט טכני</CardTitle></CardHeader>
          <CardContent>
            {specs.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <tbody>
                    {specs.map(s => (
                      <tr key={s.key} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-medium bg-muted/40 w-1/3">{s.key}</td>
                        <td className="px-4 py-2">{s.value}</td>
                        <td className="px-4 py-2 text-left w-12">
                          <button type="button" onClick={() => removeSpec(s.key)} className="text-muted-foreground hover:text-destructive">
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-2">
              <Input placeholder="שם מפרט (לדוגמה: מעבד)" value={specKey} onChange={e => setSpecKey(e.target.value)} className="w-1/3" />
              <Input placeholder="ערך (לדוגמה: Intel Core i7)" dir="ltr" value={specValue} onChange={e => setSpecValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSpec(); } }} />
              <Button type="button" variant="outline" onClick={addSpec}><Plus className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>הגדרות תצוגה</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-8">
              <div className="flex items-center gap-2">
                <Checkbox id="isActive" checked={formData.isActive} onCheckedChange={(c) => setFormData({...formData, isActive: !!c})} />
                <Label htmlFor="isActive" className="cursor-pointer font-medium">מוצר פעיל (מוצג בחנות)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="isFeatured" checked={formData.isFeatured} onCheckedChange={(c) => setFormData({...formData, isFeatured: !!c})} />
                <Label htmlFor="isFeatured" className="cursor-pointer font-medium">מוצר מומלץ (מוצג בדף הבית)</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 pb-8">
          <Button type="submit" size="lg" className="px-10 font-bold" disabled={createMutation.isPending || updateMutation.isPending}>
            {(createMutation.isPending || updateMutation.isPending) ? "שומר..." : isEditing ? "שמור שינויים" : "צור מוצר"}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => setLocation("/admin/products")}>ביטול</Button>
        </div>
      </form>
    </AdminLayout>
  );
}
