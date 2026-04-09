import { AdminLayout } from "@/components/admin-layout";
import {
  useGetProduct,
  useCreateProduct,
  useUpdateProduct,
  useListCategories,
  useListBrands,
  useCreateBrand,
  getGetProductQueryKey,
  getListBrandsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSuppliers } from "@/hooks/use-suppliers";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useState, useEffect, useRef } from "react";
import { toast } from "@/components/ui/use-toast";
import { X, Plus, ImageIcon, Video, GripVertical } from "lucide-react";
import { MediaPickerModal } from "@/components/media-picker";

export default function AdminProductForm() {
  const { id } = useParams();
  const isEditing = !!id && id !== "new";
  const productId = Number(id);
  const [_, setLocation] = useLocation();

  const queryClient = useQueryClient();
  const { data: categories } = useListCategories();
  const { data: brands } = useListBrands();
  const { data: suppliers } = useSuppliers();
  const createBrandMutation = useCreateBrand();

  const { data: product, isLoading: isLoadingProduct } = useGetProduct(
    productId,
    {
      query: { enabled: isEditing, queryKey: getGetProductQueryKey(productId) },
    },
  );

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
    costPrice: 0,
    deliveryCost: 0,
    stockQuantity: 0,
    categoryIds: [] as number[],
    brandId: "",
    supplierId: "",
    isActive: true,
    isFeatured: false,
    images: [] as string[],
    videos: [] as string[],
  });
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const dragIndexRef = useRef<number | null>(null);

  // Brand combobox
  const [brandSearch, setBrandSearch] = useState("");
  const [brandDropOpen, setBrandDropOpen] = useState(false);
  const brandDropRef = useRef<HTMLDivElement>(null);
  const [newBrandDialogOpen, setNewBrandDialogOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [isSavingBrand, setIsSavingBrand] = useState(false);

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [specs, setSpecs] = useState<{ key: string; value: string }[]>([]);
  const [specKey, setSpecKey] = useState("");
  const [specValue, setSpecValue] = useState("");

  useEffect(() => {
    if (product && isEditing) {
      const productAny = product as any;
      setFormData({
        nameHe: product.nameHe,
        nameEn: product.nameEn || "",
        slug: product.slug,
        descriptionHe: product.descriptionHe || "",
        sku: product.sku || "",
        price: product.price,
        salePrice: product.salePrice || 0,
        costPrice: productAny.costPrice || 0,
        deliveryCost: productAny.deliveryCost || 0,
        stockQuantity: product.stockQuantity,
        categoryIds: Array.isArray(productAny.categoryIds) && productAny.categoryIds.length > 0
          ? productAny.categoryIds.map(Number)
          : product.categoryId ? [product.categoryId] : [],
        brandId: product.brandId?.toString() || "",
        supplierId: productAny.supplierId?.toString() || "",
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        images: product.images || [],
        videos: productAny.videos || [],
      });
      setTags(product.tags || []);
      const specsObj = (product.specs as Record<string, string>) || {};
      setSpecs(
        Object.entries(specsObj).map(([key, value]) => ({
          key,
          value: String(value),
        })),
      );
    }
  }, [product, isEditing]);

  // Re-sync relation fields once reference data loads
  useEffect(() => {
    if (product && isEditing && suppliers?.length) {
      setFormData((prev) => ({
        ...prev,
        supplierId: (product as any).supplierId?.toString() || prev.supplierId,
        brandId: product.brandId?.toString() || prev.brandId,
      }));
    }
  }, [suppliers]);

  // Close brand dropdown on outside click
  useEffect(() => {
    if (!brandDropOpen) return;
    const handler = (e: MouseEvent) => {
      if (brandDropRef.current && !brandDropRef.current.contains(e.target as Node)) {
        setBrandDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [brandDropOpen]);

  // Create new brand from quick-add dialog
  const handleSaveNewBrand = async () => {
    const name = newBrandName.trim();
    if (!name) return;
    setIsSavingBrand(true);
    try {
      const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "").replace(/-+/g, "-");
      const created = await createBrandMutation.mutateAsync({ nameHe: name, nameEn: name, slug, isActive: true } as any);
      await queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
      setFormData((prev) => ({ ...prev, brandId: String((created as any).id) }));
      setBrandSearch(name);
      setNewBrandDialogOpen(false);
      setNewBrandName("");
      toast({ title: "מותג נוצר", description: `המותג "${name}" נוסף בהצלחה` });
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן היה ליצור את המותג", variant: "destructive" });
    } finally {
      setIsSavingBrand(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const addSpec = () => {
    if (specKey.trim() && specValue.trim()) {
      const existing = specs.findIndex((s) => s.key === specKey.trim());
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

  const removeSpec = (key: string) =>
    setSpecs(specs.filter((s) => s.key !== key));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const specsObj: Record<string, string> = {};
    specs.forEach((s) => {
      specsObj[s.key] = s.value;
    });

    const payload = {
      nameHe: formData.nameHe,
      nameEn: formData.nameEn || null,
      slug: formData.slug || formData.nameHe.replace(/\s+/g, "-").toLowerCase(),
      descriptionHe: formData.descriptionHe || null,
      sku: formData.sku || null,
      price: Number(formData.price),
      salePrice:
        Number(formData.salePrice) > 0 ? Number(formData.salePrice) : null,
      costPrice:
        Number(formData.costPrice) > 0 ? Number(formData.costPrice) : null,
      deliveryCost:
        Number(formData.deliveryCost) > 0
          ? Number(formData.deliveryCost)
          : null,
      stockQuantity: Number(formData.stockQuantity),
      categoryIds: formData.categoryIds,
      brandId: formData.brandId ? Number(formData.brandId) : null,
      supplierId: formData.supplierId ? Number(formData.supplierId) : null,
      isActive: formData.isActive,
      isFeatured: formData.isFeatured,
      images: formData.images,
      videos: formData.videos,
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

  if (isEditing && isLoadingProduct)
    return (
      <AdminLayout>
        <div className="p-8">טוען...</div>
      </AdminLayout>
    );

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">
          {isEditing ? "עריכת מוצר" : "מוצר חדש"}
        </h1>
        <Button
          variant="outline"
          onClick={() => setLocation("/admin/products")}
        >
          חזור לרשימה
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>פרטים בסיסיים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>שם מוצר (עברית) *</Label>
                <Input
                  required
                  value={formData.nameHe}
                  onChange={(e) =>
                    setFormData({ ...formData, nameHe: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>שם מוצר (אנגלית)</Label>
                <Input
                  value={formData.nameEn}
                  onChange={(e) =>
                    setFormData({ ...formData, nameEn: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>מזהה URL (Slug)</Label>
                <Input
                  dir="ltr"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  placeholder="auto-generated-if-empty"
                />
              </div>
              <div className="space-y-2">
                <Label>מק"ט (SKU)</Label>
                <Input
                  dir="ltr"
                  value={formData.sku}
                  onChange={(e) =>
                    setFormData({ ...formData, sku: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>
                  קטגוריות
                  {formData.categoryIds.length > 0 && (
                    <span className="ms-2 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold px-2 py-0.5 leading-none">
                      {formData.categoryIds.length}
                    </span>
                  )}
                </Label>
                {!categories ? (
                  <Skeleton className="h-40 w-full" />
                ) : (() => {
                  // Build parent→children map, only child categories are selectable
                  const parents = (categories ?? [])
                    .filter((c: any) => !c.parentId)
                    .sort((a: any, b: any) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99) || a.nameHe.localeCompare(b.nameHe, "he"));
                  const childrenByParent: Record<number, typeof categories> = {};
                  (categories ?? []).forEach((c: any) => {
                    if (c.parentId) {
                      if (!childrenByParent[c.parentId]) childrenByParent[c.parentId] = [];
                      childrenByParent[c.parentId].push(c);
                    }
                  });

                  const toggleCat = (id: number) => {
                    setFormData((prev) => ({
                      ...prev,
                      categoryIds: prev.categoryIds.includes(id)
                        ? prev.categoryIds.filter((x) => x !== id)
                        : [...prev.categoryIds, id],
                    }));
                  };

                  return (
                    <div className="border border-input rounded-md overflow-hidden">
                      {/* Selected summary bar */}
                      {formData.categoryIds.length > 0 && (
                        <div className="bg-muted/60 px-3 py-1.5 border-b border-input flex flex-wrap gap-1.5">
                          {formData.categoryIds.map((cid) => {
                            const cat = (categories ?? []).find((c: any) => c.id === cid);
                            return cat ? (
                              <span
                                key={cid}
                                className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full"
                              >
                                {cat.nameHe}
                                <button
                                  type="button"
                                  onClick={() => toggleCat(cid)}
                                  className="hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                      {/* Scrollable checkbox list */}
                      <div className="max-h-56 overflow-y-auto overscroll-contain divide-y divide-border/50">
                        {parents.map((parent: any) => {
                          const kids = (childrenByParent[parent.id] ?? [])
                            .sort((a: any, b: any) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99) || a.nameHe.localeCompare(b.nameHe, "he"));
                          return (
                            <div key={parent.id}>
                              {/* Parent header — not selectable */}
                              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                                  {parent.nameHe}
                                </span>
                              </div>
                              {/* Child checkboxes */}
                              {kids.length === 0 ? (
                                <div className="px-6 py-1.5 text-xs text-muted-foreground italic">אין תת-קטגוריות</div>
                              ) : (
                                kids.map((child: any) => {
                                  const checked = formData.categoryIds.includes(child.id);
                                  return (
                                    <label
                                      key={child.id}
                                      className={`flex items-center gap-2.5 px-6 py-2 cursor-pointer hover:bg-accent/50 transition-colors select-none ${checked ? "bg-primary/5" : ""}`}
                                    >
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={() => toggleCat(child.id)}
                                        id={`cat-${child.id}`}
                                      />
                                      <span className="text-sm">{child.nameHe}</span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="space-y-2">
                <Label>מותג</Label>
                {!brands ? (
                  <Skeleton className="h-9 w-full" />
                ) : (() => {
                  const selectedBrand = brands.find((b: any) => b.id.toString() === formData.brandId);
                  const q = brandSearch.trim().toLowerCase();
                  const filtered = brands.filter((b: any) =>
                    !q ||
                    b.nameHe?.toLowerCase().includes(q) ||
                    b.nameEn?.toLowerCase().includes(q)
                  );
                  const exactMatch = brands.some((b: any) =>
                    b.nameHe?.toLowerCase() === q || b.nameEn?.toLowerCase() === q
                  );
                  return (
                    <div ref={brandDropRef} className="relative">
                      <div className="flex items-center gap-1 border border-input rounded-md px-3 py-2 bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                        <input
                          type="text"
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
                          placeholder={selectedBrand ? selectedBrand.nameHe : "חפש או בחר מותג..."}
                          value={brandDropOpen ? brandSearch : (selectedBrand ? selectedBrand.nameHe : "")}
                          onFocus={() => {
                            setBrandSearch("");
                            setBrandDropOpen(true);
                          }}
                          onChange={(e) => {
                            setBrandSearch(e.target.value);
                            setBrandDropOpen(true);
                          }}
                        />
                        {formData.brandId && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, brandId: "" }));
                              setBrandSearch("");
                            }}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            aria-label="נקה מותג"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {brandDropOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-56 overflow-y-auto">
                          {filtered.length === 0 && !q && (
                            <div className="px-3 py-2 text-sm text-muted-foreground">אין מותגים</div>
                          )}
                          {filtered.map((b: any) => (
                            <button
                              key={b.id}
                              type="button"
                              className={`w-full text-right px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between ${formData.brandId === b.id.toString() ? "bg-accent font-medium" : ""}`}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, brandId: b.id.toString() }));
                                setBrandSearch(b.nameHe);
                                setBrandDropOpen(false);
                              }}
                            >
                              <span>{b.nameHe}</span>
                              {b.nameEn && <span className="text-xs text-muted-foreground">{b.nameEn}</span>}
                            </button>
                          ))}
                          {q && !exactMatch && (
                            <button
                              type="button"
                              className="w-full text-right px-3 py-2 text-sm text-primary hover:bg-primary/10 transition-colors flex items-center gap-2 border-t border-border"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setBrandDropOpen(false);
                                setNewBrandName(brandSearch.trim());
                                setNewBrandDialogOpen(true);
                              }}
                            >
                              <Plus className="h-3.5 w-3.5 shrink-0" />
                              <span>הוסף מותג חדש: <strong>{brandSearch.trim()}</strong></span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="space-y-2">
                <Label>ספק</Label>
                {!suppliers ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Select
                    key={`sup-${formData.supplierId}`}
                    value={formData.supplierId || "__none__"}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        supplierId: v === "__none__" ? "" : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר ספק" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">ללא ספק</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>תיאור המוצר</Label>
                <RichTextEditor
                  value={formData.descriptionHe}
                  onChange={(html) =>
                    setFormData({ ...formData, descriptionHe: html })
                  }
                  placeholder="הזן תיאור מפורט של המוצר..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>מחיר ומלאי</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>מחיר רגיל (₪) *</Label>
                <Input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>מחיר מבצע (₪)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.salePrice || ""}
                  placeholder="ריק = אין מבצע"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      salePrice: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>כמות במלאי *</Label>
                <Input
                  type="number"
                  required
                  min="0"
                  value={formData.stockQuantity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stockQuantity: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>מחיר עלות (₪)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.costPrice || ""}
                  placeholder="ריק = לא מוגדר"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      costPrice: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>עלות משלוח (₪)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.deliveryCost || ""}
                  placeholder="ריק = לא מוגדר"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deliveryCost: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>תמונות</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMediaPickerOpen(true)}
            >
              <ImageIcon className="ml-2 h-4 w-4" /> הוסף תמונה מהמדיה
            </Button>
          </CardHeader>
          <CardContent>
            {formData.images.length === 0 ? (
              <button
                type="button"
                className="w-full border-2 border-dashed border-muted-foreground/30 rounded-xl py-8 text-sm text-muted-foreground hover:border-primary/50 transition-colors"
                onClick={() => setMediaPickerOpen(true)}
              >
                <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                לחץ כדי להוסיף תמונות מהמדיה
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  גרור כדי לשנות סדר · התמונה הראשונה היא התמונה הראשית
                </p>
                <div className="flex flex-wrap gap-3">
                  {formData.images.map((url, i) => (
                    <div
                      key={url + i}
                      draggable
                      onDragStart={() => {
                        dragIndexRef.current = i;
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = dragIndexRef.current;
                        if (from === null || from === i) return;
                        setFormData((f) => {
                          const imgs = [...f.images];
                          const [moved] = imgs.splice(from, 1);
                          imgs.splice(i, 0, moved);
                          return { ...f, images: imgs };
                        });
                        dragIndexRef.current = null;
                      }}
                      onDragEnd={() => {
                        dragIndexRef.current = null;
                      }}
                      className="relative group w-24 h-24 rounded-lg overflow-hidden border border-border bg-muted cursor-grab active:cursor-grabbing select-none"
                    >
                      <img
                        src={url}
                        alt=""
                        className="w-full h-full object-cover pointer-events-none"
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-white drop-shadow">
                        <GripVertical className="h-4 w-4" />
                      </div>
                      {i === 0 && (
                        <span className="absolute bottom-0 inset-x-0 bg-primary text-primary-foreground text-[10px] text-center py-0.5 font-medium">
                          ראשית
                        </span>
                      )}
                      <button
                        type="button"
                        className="absolute top-1 left-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() =>
                          setFormData((f) => ({
                            ...f,
                            images: f.images.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors flex flex-col items-center justify-center text-muted-foreground text-xs gap-1"
                    onClick={() => setMediaPickerOpen(true)}
                  >
                    <Plus className="h-5 w-5" />
                    הוסף
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>סרטונים</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setVideoPickerOpen(true)}
            >
              <Video className="ml-2 h-4 w-4" /> הוסף סרטון מהמדיה
            </Button>
          </CardHeader>
          <CardContent>
            {formData.videos.length === 0 ? (
              <button
                type="button"
                className="w-full border-2 border-dashed border-muted-foreground/30 rounded-xl py-8 text-sm text-muted-foreground hover:border-primary/50 transition-colors"
                onClick={() => setVideoPickerOpen(true)}
              >
                <Video className="h-8 w-8 mx-auto mb-2 opacity-40" />
                לחץ כדי להוסיף סרטונים מהמדיה
              </button>
            ) : (
              <div className="flex flex-wrap gap-3">
                {formData.videos.map((url, i) => (
                  <div
                    key={url + i}
                    className="relative group w-32 h-24 rounded-lg overflow-hidden border border-border bg-muted"
                  >
                    <video
                      src={url}
                      className="w-full h-full object-cover pointer-events-none"
                      muted
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                      <div className="bg-black/50 rounded-full p-1.5">
                        <Video className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="absolute top-1 left-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() =>
                        setFormData((f) => ({
                          ...f,
                          videos: f.videos.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="w-32 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors flex flex-col items-center justify-center text-muted-foreground text-xs gap-1"
                  onClick={() => setVideoPickerOpen(true)}
                >
                  <Plus className="h-5 w-5" />
                  הוסף
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <MediaPickerModal
          open={mediaPickerOpen}
          onOpenChange={setMediaPickerOpen}
          onSelect={(url) =>
            setFormData((f) => ({ ...f, images: [...f.images, url] }))
          }
          title="הוסף תמונה למוצר"
          filter="image"
        />
        <MediaPickerModal
          open={videoPickerOpen}
          onOpenChange={setVideoPickerOpen}
          onSelect={(url) =>
            setFormData((f) => ({ ...f, videos: [...f.videos, url] }))
          }
          title="הוסף סרטון למוצר"
          filter="video"
        />

        <Card>
          <CardHeader>
            <CardTitle>תגיות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 text-sm pl-1"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-muted-foreground hover:text-foreground ml-1"
                  >
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
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>מפרט טכני</CardTitle>
          </CardHeader>
          <CardContent>
            {specs.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <tbody>
                    {specs.map((s) => (
                      <tr
                        key={s.key}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-2 font-medium bg-muted/40 w-1/3">
                          {s.key}
                        </td>
                        <td className="px-4 py-2">{s.value}</td>
                        <td className="px-4 py-2 text-left w-12">
                          <button
                            type="button"
                            onClick={() => removeSpec(s.key)}
                            className="text-muted-foreground hover:text-destructive"
                          >
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
              <Input
                placeholder="שם מפרט (לדוגמה: מעבד)"
                value={specKey}
                onChange={(e) => setSpecKey(e.target.value)}
                className="w-1/3"
              />
              <Input
                placeholder="ערך (לדוגמה: Intel Core i7)"
                dir="ltr"
                value={specValue}
                onChange={(e) => setSpecValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSpec();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addSpec}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>הגדרות תצוגה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(c) =>
                    setFormData({ ...formData, isActive: !!c })
                  }
                />
                <Label
                  htmlFor="isActive"
                  className="cursor-pointer font-medium"
                >
                  מוצר פעיל (מוצג בחנות)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isFeatured"
                  checked={formData.isFeatured}
                  onCheckedChange={(c) =>
                    setFormData({ ...formData, isFeatured: !!c })
                  }
                />
                <Label
                  htmlFor="isFeatured"
                  className="cursor-pointer font-medium"
                >
                  מוצר מומלץ (מוצג בדף הבית)
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 pb-8">
          <Button
            type="submit"
            size="lg"
            className="px-10 font-bold"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending
              ? "שומר..."
              : isEditing
                ? "שמור שינויים"
                : "צור מוצר"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setLocation("/admin/products")}
          >
            ביטול
          </Button>
        </div>
      </form>

      {/* Quick-add brand dialog */}
      <Dialog open={newBrandDialogOpen} onOpenChange={setNewBrandDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוספת מותג חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-brand-name">שם המותג</Label>
              <Input
                id="new-brand-name"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="שם המותג..."
                onKeyDown={(e) => e.key === "Enter" && handleSaveNewBrand()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
            <Button onClick={handleSaveNewBrand} disabled={!newBrandName.trim() || isSavingBrand}>
              {isSavingBrand ? "שומר..." : "הוסף מותג"}
            </Button>
            <Button variant="outline" onClick={() => setNewBrandDialogOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
