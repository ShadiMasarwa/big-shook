import { AdminLayout } from "@/components/admin-layout";
import { useExportProducts, useExportOrders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function AdminImport() {
  const exportProducts = useExportProducts();
  const exportOrders = useExportOrders();

  const handleExportProducts = async () => {
    try {
      const data = await exportProducts.mutateAsync();
      const blob = new Blob([data as any], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "ייצוא מוצרים הושלם בהצלחה" });
    } catch (e) {
      toast({ title: "שגיאה בייצוא מוצרים", variant: "destructive" });
    }
  };

  const handleExportOrders = async () => {
    try {
      const data = await exportOrders.mutateAsync({});
      const blob = new Blob([data as any], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "ייצוא הזמנות הושלם בהצלחה" });
    } catch (e) {
      toast({ title: "שגיאה בייצוא הזמנות", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-8">ייצוא וייבוא נתונים</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> ייצוא נתונים (CSV)</CardTitle>
            <CardDescription>הורד נתונים למחשב שלך בפורמט אקסל</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full justify-between h-12" onClick={handleExportProducts}>
              <span>ייצא קטלוג מוצרים</span>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="w-full justify-between h-12" onClick={handleExportOrders}>
              <span>ייצא דוח הזמנות</span>
              <Download className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> ייבוא מוצרים</CardTitle>
            <CardDescription>העלה קובץ JSON או CSV לעדכון מרוכז</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-muted/20">
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="font-medium mb-1">לחץ לבחירת קובץ או גרור לכאן</p>
              <p className="text-xs text-muted-foreground mb-4">תומך בקבצי CSV ו-JSON בלבד</p>
              <Button disabled>בחר קובץ (בקרוב)</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
