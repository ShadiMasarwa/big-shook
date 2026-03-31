import { AdminLayout } from "@/components/admin-layout";
import { 
  useGetProduct, 
  useCreateProduct, 
  useUpdateProduct, 
  useListCategories, 
  useListBrands,
  getGetProductQueryKey
} from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminProductForm() {
  const { id } = useParams();
  const isEditing = !!id && id !== "new";
  const productId = Number(id);
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: categories } = useListCategories();
  const { data: brands } = useListBrands();
  
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
    isActive: true,
    isFeatured: false,
    images: "", // comma separated
  });

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
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        images: product.images.join("\n"),
      });
    }
  }, [product, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      isActive: formData.isActive,
      isFeatured: formData.isFeatured,
      images: formData.images.split("\n").map(s => s.trim()).filter(Boolean),
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

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-8 max-w-4xl">
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
            <Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="auto-generated-if-empty" />
          </div>
          <div className="space-y-2">
            <Label>מק"ט</Label>
            <Input value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>מחיר (₪) *</Label>
            <Input type="number" required min="0" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
          </div>
          <div className="space-y-2">
            <Label>מחיר מבצע (₪)</Label>
            <Input type="number" min="0" value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: Number(e.target.value)})} />
          </div>
          <div className="space-y-2">
            <Label>מלאי *</Label>
            <Input type="number" required min="0" value={formData.stockQuantity} onChange={e => setFormData({...formData, stockQuantity: Number(e.target.value)})} />
          </div>
          
          <div className="space-y-2">
            <Label>קטגוריה</Label>
            <Select value={formData.categoryId} onValueChange={v => setFormData({...formData, categoryId: v})}>
              <SelectTrigger>
                <SelectValue placeholder="בחר קטגוריה" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.nameHe}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>תיאור</Label>
          <Textarea className="h-32" value={formData.descriptionHe} onChange={e => setFormData({...formData, descriptionHe: e.target.value})} />
        </div>

        <div className="space-y-2">
          <Label>קישורים לתמונות (כל תמונה בשורה נפרדת)</Label>
          <Textarea className="h-32" dir="ltr" placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg" value={formData.images} onChange={e => setFormData({...formData, images: e.target.value})} />
        </div>

        <div className="flex gap-6">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox id="isActive" checked={formData.isActive} onCheckedChange={(c) => setFormData({...formData, isActive: !!c})} />
            <Label htmlFor="isActive" className="cursor-pointer">מוצר פעיל</Label>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox id="isFeatured" checked={formData.isFeatured} onCheckedChange={(c) => setFormData({...formData, isFeatured: !!c})} />
            <Label htmlFor="isFeatured" className="cursor-pointer">מוצר מומלץ (דף הבית)</Label>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <Button type="submit" size="lg" className="px-8 font-bold">{isEditing ? "שמור שינויים" : "צור מוצר"}</Button>
        </div>
      </form>
    </AdminLayout>
  );
}
