import { Link } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useListUsers } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, MailX } from "lucide-react";

export default function AdminUsers() {
  const { data, isLoading } = useListUsers({ limit: 50 });

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">ניהול לקוחות</h1>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">שם הלקוח</TableHead>
              <TableHead className="text-right">אימייל</TableHead>
              <TableHead className="text-center">דרגת מועדון</TableHead>
              <TableHead className="text-center">נקודות</TableHead>
              <TableHead className="text-center">הזמנות</TableHead>
              <TableHead className="text-center">פרסומים</TableHead>
              <TableHead className="text-left">סה"כ קניות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
               [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 mx-auto rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-5 mx-auto rounded" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : !data?.users || data.users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">אין לקוחות במערכת</TableCell>
              </TableRow>
            ) : (
              data.users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/customers/${user.id}`} className="hover:text-primary hover:underline transition-colors">
                      {user.firstName} {user.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="uppercase font-bold tracking-wider text-xs">
                      {user.loyaltyTier}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-bold text-amber-600">{user.loyaltyPoints}</TableCell>
                  <TableCell className="text-center">{user.ordersCount}</TableCell>
                  <TableCell className="text-center">
                    {user.marketingEmails
                      ? <Mail className="h-4 w-4 text-green-500 mx-auto" />
                      : <MailX className="h-4 w-4 text-muted-foreground mx-auto" />
                    }
                  </TableCell>
                  <TableCell className="text-left font-bold text-primary">{formatPrice(user.totalSpent)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
}
