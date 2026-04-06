import { useState, useMemo } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useListUsers } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, MailX, ChevronUp, ChevronDown, ChevronsUpDown, Search } from "lucide-react";

type SortCol = "name" | "email" | "loyaltyTier" | "loyaltyPoints" | "ordersCount" | "marketingEmails" | "isActive" | "totalSpent";
type SortDir = "asc" | "desc";

const TIER_ORDER: Record<string, number> = { bronze: 1, silver: 2, gold: 3, vip: 4 };

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: SortDir }) {
  if (sortCol !== col) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3 w-3 text-primary" />
    : <ChevronDown className="h-3 w-3 text-primary" />;
}

export default function AdminUsers() {
  const { data, isLoading } = useListUsers({ limit: 200 });

  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const thClass = (col: SortCol, align: string) =>
    `${align} cursor-pointer select-none hover:text-primary transition-colors`;

  const processed = useMemo(() => {
    const users = data?.users ?? [];
    const q = search.trim().toLowerCase();

    const filtered = q
      ? users.filter(u =>
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        )
      : users;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "name":
          cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "he");
          break;
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "loyaltyTier":
          cmp = (TIER_ORDER[a.loyaltyTier ?? "bronze"] ?? 0) - (TIER_ORDER[b.loyaltyTier ?? "bronze"] ?? 0);
          break;
        case "loyaltyPoints":
          cmp = (a.loyaltyPoints ?? 0) - (b.loyaltyPoints ?? 0);
          break;
        case "ordersCount":
          cmp = (a.ordersCount ?? 0) - (b.ordersCount ?? 0);
          break;
        case "marketingEmails":
          cmp = Number(a.marketingEmails) - Number(b.marketingEmails);
          break;
        case "isActive":
          cmp = Number(a.isActive) - Number(b.isActive);
          break;
        case "totalSpent":
          cmp = (a.totalSpent ?? 0) - (b.totalSpent ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, search, sortCol, sortDir]);

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">ניהול לקוחות</h1>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="חיפוש לפי שם או אימייל..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={thClass("name", "text-right")} onClick={() => handleSort("name")}>
                <span className="inline-flex items-center gap-1">שם הלקוח <SortIcon col="name" sortCol={sortCol} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className={thClass("email", "text-right")} onClick={() => handleSort("email")}>
                <span className="inline-flex items-center gap-1">אימייל <SortIcon col="email" sortCol={sortCol} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className={thClass("loyaltyTier", "text-center")} onClick={() => handleSort("loyaltyTier")}>
                <span className="inline-flex items-center justify-center gap-1">דרגת מועדון <SortIcon col="loyaltyTier" sortCol={sortCol} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className={thClass("loyaltyPoints", "text-center")} onClick={() => handleSort("loyaltyPoints")}>
                <span className="inline-flex items-center justify-center gap-1">נקודות <SortIcon col="loyaltyPoints" sortCol={sortCol} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className={thClass("ordersCount", "text-center")} onClick={() => handleSort("ordersCount")}>
                <span className="inline-flex items-center justify-center gap-1">הזמנות <SortIcon col="ordersCount" sortCol={sortCol} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className={thClass("marketingEmails", "text-center")} onClick={() => handleSort("marketingEmails")}>
                <span className="inline-flex items-center justify-center gap-1">פרסומים <SortIcon col="marketingEmails" sortCol={sortCol} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className={thClass("isActive", "text-center")} onClick={() => handleSort("isActive")}>
                <span className="inline-flex items-center justify-center gap-1">סטטוס <SortIcon col="isActive" sortCol={sortCol} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className={thClass("totalSpent", "text-left")} onClick={() => handleSort("totalSpent")}>
                <span className="inline-flex items-center gap-1">סה"כ קניות <SortIcon col="totalSpent" sortCol={sortCol} sortDir={sortDir} /></span>
              </TableHead>
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
                  <TableCell><Skeleton className="h-5 w-16 mx-auto rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : processed.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  {search ? "לא נמצאו לקוחות התואמים לחיפוש" : "אין לקוחות במערכת"}
                </TableCell>
              </TableRow>
            ) : (
              processed.map(user => (
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
                  <TableCell className="text-center">
                    {user.isActive
                      ? <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs">פעיל</Badge>
                      : <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">מושהה</Badge>
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
