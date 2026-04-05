import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Trash2,
  Upload,
  ImageIcon,
  Video,
  Check,
  X,
  Search,
  Play,
} from "lucide-react";

export interface MediaItem {
  id: number;
  objectPath: string;
  originalName: string;
  mimeType: string;
  size: number;
  altText: string | null;
  title: string | null;
  createdAt: string;
}

export function mediaUrl(item: MediaItem): string {
  return `/api/uploads/${item.objectPath}`;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isVideo(item: MediaItem) {
  return item.mimeType.startsWith("video/");
}

export function isGif(item: MediaItem) {
  return item.mimeType === "image/gif";
}

export const MEDIA_QUERY_KEY = ["media"];

export function useMedia() {
  return useQuery<MediaItem[]>({
    queryKey: MEDIA_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/media");
      if (!res.ok) throw new Error("Failed to load media");
      return res.json();
    },
  });
}

export function useUploadMedia() {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = useCallback(async (file: File): Promise<MediaItem | null> => {
    setIsUploading(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);

      return await new Promise<MediaItem | null>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            queryClient.invalidateQueries({ queryKey: MEDIA_QUERY_KEY });
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error("Upload failed"));
          }
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.open("POST", "/api/media/upload");
        xhr.send(formData);
      });
    } catch {
      return null;
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  }, [queryClient]);

  return { uploadFile, isUploading, progress };
}

interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  title?: string;
  filter?: "image" | "video";
}

export function MediaPickerModal({
  open,
  onOpenChange,
  onSelect,
  title,
  filter,
}: MediaPickerProps) {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useMedia();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress } = useUploadMedia();

  const defaultTitle = filter === "video" ? "בחר סרטון מהמדיה" : "בחר תמונה מהמדיה";

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEDIA_QUERY_KEY });
      setSelected(null);
      toast("קובץ נמחק");
    },
    onError: () => toast("שגיאה במחיקה"),
  });

  const handleUpload = useCallback(async (file: File) => {
    const isImg = file.type.startsWith("image/");
    const isVid = file.type.startsWith("video/");
    if (!isImg && !isVid) { toast("יש להעלות קובץ תמונה או סרטון בלבד"); return; }
    if (filter === "image" && !isImg) { toast("יש להעלות קובץ תמונה בלבד"); return; }
    if (filter === "video" && !isVid) { toast("יש להעלות קובץ סרטון בלבד"); return; }
    await uploadFile(file);
  }, [uploadFile, filter]);

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

  const filteredItems = items.filter((item) => {
    if (filter === "image" && isVideo(item)) return false;
    if (filter === "video" && !isVideo(item)) return false;
    if (!search) return true;
    return (
      item.originalName.toLowerCase().includes(search.toLowerCase()) ||
      (item.altText || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.title || "").toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleConfirm = () => {
    if (!selected) return;
    onSelect(mediaUrl(selected));
    onOpenChange(false);
    setSelected(null);
  };

  const acceptAttr =
    filter === "image" ? "image/*" :
    filter === "video" ? "video/*" :
    "image/*,video/*";

  const uploadHint =
    filter === "image" ? "PNG, JPG, GIF, WebP — עד 10MB" :
    filter === "video" ? "MP4, WebM, MOV — עד 200MB" :
    "תמונות ו-PNG, JPG, סרטוני MP4, WebM — עד 200MB";

  const uploadLabel = filter === "video" ? "גרור סרטון לכאן או לחץ להעלאה" : "גרור תמונה לכאן או לחץ להעלאה";
  const emptyLabel = filter === "video"
    ? (search ? "לא נמצאו סרטונים מתאימים" : "אין סרטונים בספריה. העלה סרטון ראשון!")
    : (search ? "לא נמצאו קבצים מתאימים" : "אין קבצים בספריה. העלה קובץ ראשון!");
  const footerCount = `${filteredItems.length} ${filter === "video" ? "סרטונים" : filter === "image" ? "תמונות" : "קבצים"} בספריה`;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSelected(null); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
          <DialogTitle className="text-xl">{title || defaultTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div
            className={`mx-6 mt-4 border-2 border-dashed rounded-xl transition-colors cursor-pointer ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"} ${isUploading ? "opacity-60 pointer-events-none" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center py-5 gap-2">
              {filter === "video" ? <Video className="h-7 w-7 text-muted-foreground" /> : <Upload className="h-7 w-7 text-muted-foreground" />}
              {isUploading ? (
                <div className="text-sm text-center">
                  <p className="font-medium">מעלה... {progress}%</p>
                  <div className="mt-1 h-1.5 w-40 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium">{uploadLabel}</p>
                  <p className="text-xs text-muted-foreground">{uploadHint}</p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept={acceptAttr} multiple className="hidden" onChange={handleFileChange} />
          </div>

          <div className="px-6 py-3">
            <div className="relative">
              <Search className="absolute top-1/2 -translate-y-1/2 right-3 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש לפי שם..." className="pr-9" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {isLoading ? (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                {[...Array(12)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                {filter === "video" ? <Video className="h-12 w-12" /> : <ImageIcon className="h-12 w-12" />}
                <p>{emptyLabel}</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                {filteredItems.map((item) => {
                  const isSelected = selected?.id === item.id;
                  const itemIsVideo = isVideo(item);
                  return (
                    <div
                      key={item.id}
                      className={`group relative aspect-square rounded-lg border-2 cursor-pointer overflow-hidden transition-all bg-muted ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/40"}`}
                      onClick={() => setSelected(isSelected ? null : item)}
                    >
                      {itemIsVideo ? (
                        <>
                          <video src={mediaUrl(item)} className="w-full h-full object-cover" muted preload="metadata" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <div className="bg-black/50 rounded-full p-1.5"><Play className="h-4 w-4 text-white fill-white" /></div>
                          </div>
                        </>
                      ) : (
                        <img src={mediaUrl(item)} alt={item.altText || item.originalName} className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%23999' font-size='12'%3E?%3C/text%3E%3C/svg%3E"; }}
                        />
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="bg-primary rounded-full p-1"><Check className="h-4 w-4 text-primary-foreground" /></div>
                        </div>
                      )}
                      <button
                        className="absolute top-1 left-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(item.id); }}
                        title="מחק"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.title || item.originalName}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {selected ? `נבחר: ${selected.originalName} (${formatSize(selected.size)})` : footerCount}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); setSelected(null); }}>ביטול</Button>
            <Button disabled={!selected} onClick={handleConfirm}>{filter === "video" ? "בחר סרטון" : "בחר קובץ"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MediaPickerButtonProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  className?: string;
}

export function MediaPickerButton({ value, onChange, label = "בחר תמונה", className }: MediaPickerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <div className="flex gap-2 items-start">
        {value && (
          <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border shrink-0">
            <img src={value} alt="" className="w-full h-full object-cover" />
            <button type="button" className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5" onClick={() => onChange("")}>
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
        <div className="flex-1 space-y-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="w-full">
            <ImageIcon className="ml-2 h-4 w-4" />
            {value ? "החלף תמונה" : label}
          </Button>
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="או הדבק כתובת URL ישירות..." dir="ltr" className="text-xs" />
        </div>
      </div>
      <MediaPickerModal open={open} onOpenChange={setOpen} onSelect={onChange} filter="image" />
    </div>
  );
}
