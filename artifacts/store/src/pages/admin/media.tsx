import { useState, useRef, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMedia, useUploadMedia, mediaUrl, isVideo, isGif, MEDIA_QUERY_KEY, type MediaItem } from "@/components/media-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Upload,
  Trash2,
  Download,
  Pencil,
  Search,
  ImageIcon,
  Film,
  X,
  Play,
  CheckSquare,
} from "lucide-react";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface EditDialogProps {
  item: MediaItem | null;
  onClose: () => void;
}

function EditDialog({ item, onClose }: EditDialogProps) {
  const queryClient = useQueryClient();
  const [altText, setAltText] = useState(item?.altText ?? "");
  const [title, setTitle] = useState(item?.title ?? "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/media/${item!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altText, title }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEDIA_QUERY_KEY });
      toast.success("הפרטים נשמרו");
      onClose();
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  if (!item) return null;

  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>עריכת פרטי קובץ</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            {isVideo(item) ? (
              <video src={mediaUrl(item)} controls className="max-h-full max-w-full" />
            ) : (
              <img src={mediaUrl(item)} alt={item.altText || item.originalName} className="max-h-full max-w-full object-contain" />
            )}
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><span className="font-medium">שם קובץ:</span> {item.originalName}</p>
            <p><span className="font-medium">גודל:</span> {formatSize(item.size)}</p>
            <p><span className="font-medium">סוג:</span> {item.mimeType}</p>
            <p><span className="font-medium">תאריך העלאה:</span> {formatDate(item.createdAt)}</p>
            <p className="font-mono text-xs text-muted-foreground/60 break-all">URL: /api/uploads/{item.objectPath}</p>
          </div>
          <div className="space-y-2">
            <Label>כותרת</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="כותרת הקובץ..." />
          </div>
          <div className="space-y-2">
            <Label>טקסט חלופי (alt)</Label>
            <Input value={altText} onChange={e => setAltText(e.target.value)} placeholder="תיאור לנגישות..." />
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "שומר..." : "שמור שינויים"}
            </Button>
            <Button variant="outline" onClick={onClose}>ביטול</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MediaGridProps {
  items: MediaItem[];
  isLoading: boolean;
  onEdit: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
  onDownload: (item: MediaItem) => void;
  emptyLabel: string;
}

function MediaGrid({ items, isLoading, onEdit, onDelete, onDownload, emptyLabel }: MediaGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {[...Array(12)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <ImageIcon className="h-16 w-16 opacity-30" />
        <p className="text-lg">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {items.map(item => {
        const itemIsVideo = isVideo(item);
        return (
          <div key={item.id} className="group relative aspect-square rounded-xl overflow-hidden border border-border bg-muted hover:border-primary/50 transition-all">
            {itemIsVideo ? (
              <>
                <video src={mediaUrl(item)} className="w-full h-full object-cover" muted preload="metadata" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                  <div className="bg-black/60 rounded-full p-2"><Play className="h-5 w-5 text-white fill-white" /></div>
                </div>
              </>
            ) : (
              <img
                src={mediaUrl(item)}
                alt={item.altText || item.originalName}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3C/svg%3E"; }}
              />
            )}

            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
              <Button size="sm" variant="secondary" className="w-20 text-xs h-7" onClick={() => onEdit(item)}>
                <Pencil className="h-3 w-3 ml-1" /> עריכה
              </Button>
              <Button size="sm" variant="secondary" className="w-20 text-xs h-7" onClick={() => onDownload(item)}>
                <Download className="h-3 w-3 ml-1" /> הורדה
              </Button>
              <Button size="sm" variant="destructive" className="w-20 text-xs h-7" onClick={() => onDelete(item)}>
                <Trash2 className="h-3 w-3 ml-1" /> מחיקה
              </Button>
            </div>

            {/* Filename label */}
            <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[10px] px-1.5 py-1 truncate opacity-0 group-hover:opacity-0 transition-opacity" />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[9px] px-1.5 py-1 truncate pointer-events-none">
              {item.title || item.originalName}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminMedia() {
  const queryClient = useQueryClient();
  const { data: allItems = [], isLoading } = useMedia();
  const { uploadFile, isUploading, progress } = useUploadMedia();

  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<MediaItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images = allItems.filter(i => !isVideo(i) && !isGif(i));
  const gifs = allItems.filter(i => isGif(i));
  const videos = allItems.filter(i => isVideo(i));

  const filterItems = (items: MediaItem[]) => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(i =>
      i.originalName.toLowerCase().includes(q) ||
      (i.title || "").toLowerCase().includes(q) ||
      (i.altText || "").toLowerCase().includes(q)
    );
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEDIA_QUERY_KEY });
      setDeleteItem(null);
      toast.success("הקובץ נמחק");
    },
    onError: () => toast.error("שגיאה במחיקה"),
  });

  const handleUpload = useCallback(async (file: File) => {
    const allowed = file.type.startsWith("image/") || file.type.startsWith("video/");
    if (!allowed) { toast.error("יש להעלות קובץ תמונה או סרטון בלבד"); return; }
    const result = await uploadFile(file);
    if (result) toast.success(`${file.name} הועלה בהצלחה`);
    else toast.error(`שגיאה בהעלאת ${file.name}`);
  }, [uploadFile]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) await handleUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) await handleUpload(file);
  };

  const handleDownload = (item: MediaItem) => {
    const a = document.createElement("a");
    a.href = mediaUrl(item);
    a.download = item.originalName;
    a.click();
  };

  const totalSize = allItems.reduce((s, i) => s + i.size, 0);

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">ספריית מדיה</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {allItems.length} קבצים · {formatSize(totalSize)} בשימוש
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="gap-2">
            <Upload className="h-4 w-4" />
            {isUploading ? `מעלה... ${progress}%` : "העלה קבצים"}
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* Upload progress bar */}
      {isUploading && (
        <div className="mb-4 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`mb-6 border-2 border-dashed rounded-xl transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-muted-foreground/40"} ${isUploading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
          <Upload className="h-8 w-8 opacity-50" />
          <p className="text-sm font-medium">גרור קבצים לכאן להעלאה מהירה</p>
          <p className="text-xs opacity-60">תמונות (JPG, PNG, WebP, GIF) · סרטונים (MP4, WebM) · עד 200MB לקובץ</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute top-1/2 -translate-y-1/2 right-3 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם, כותרת או תגית..."
          className="pr-9"
        />
        {search && (
          <button className="absolute top-1/2 -translate-y-1/2 left-3" onClick={() => setSearch("")}>
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="images">
        <TabsList className="mb-5">
          <TabsTrigger value="images" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            תמונות
            <span className="text-xs bg-muted px-1.5 rounded-full">{images.length}</span>
          </TabsTrigger>
          <TabsTrigger value="gifs" className="gap-2">
            <CheckSquare className="h-4 w-4" />
            GIF
            <span className="text-xs bg-muted px-1.5 rounded-full">{gifs.length}</span>
          </TabsTrigger>
          <TabsTrigger value="videos" className="gap-2">
            <Film className="h-4 w-4" />
            סרטונים
            <span className="text-xs bg-muted px-1.5 rounded-full">{videos.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="images">
          <MediaGrid
            items={filterItems(images)}
            isLoading={isLoading}
            onEdit={setEditItem}
            onDelete={setDeleteItem}
            onDownload={handleDownload}
            emptyLabel={search ? "לא נמצאו תמונות" : "אין תמונות בספריה"}
          />
        </TabsContent>

        <TabsContent value="gifs">
          <MediaGrid
            items={filterItems(gifs)}
            isLoading={isLoading}
            onEdit={setEditItem}
            onDelete={setDeleteItem}
            onDownload={handleDownload}
            emptyLabel={search ? "לא נמצאו GIFים" : "אין GIFים בספריה"}
          />
        </TabsContent>

        <TabsContent value="videos">
          <MediaGrid
            items={filterItems(videos)}
            isLoading={isLoading}
            onEdit={setEditItem}
            onDelete={setDeleteItem}
            onDownload={handleDownload}
            emptyLabel={search ? "לא נמצאו סרטונים" : "אין סרטונים בספריה"}
          />
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <EditDialog item={editItem} onClose={() => setEditItem(null)} />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteItem} onOpenChange={o => { if (!o) setDeleteItem(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת קובץ</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את "{deleteItem?.title || deleteItem?.originalName}"?
              הקובץ יוסר לצמיתות ולא ניתן לשחזרו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
              disabled={deleteMutation.isPending}
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
