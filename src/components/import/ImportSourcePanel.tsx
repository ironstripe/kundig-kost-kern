import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileUp, Link2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ALLOWED_MIME, ALLOWED_URL_HOSTS, MAX_IMPORT_BYTES, MIME_EXT, sniffMime, formatBytes, type AllowedMime } from "@/lib/import-schema";
import { importFromUrl, registerFileImport } from "@/lib/import.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = { menuCardId: string; onCreated: (jobId: string) => void };

const BUCKET = "menu-sources";

async function detectMime(file: File): Promise<AllowedMime | null> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffMime(head);
  if (!sniffed) return null;
  if (file.type && (ALLOWED_MIME as readonly string[]).includes(file.type) && file.type !== sniffed) return null;
  return sniffed;
}

/** Step 1 – provide a document. Nothing is analysed here; it only creates a pending job. */
export function ImportSourcePanel({ menuCardId, onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const register = useServerFn(registerFileImport);
  const fromUrl = useServerFn(importFromUrl);

  const upload = useMutation({
    mutationFn: async (f: File) => {
      if (f.size > MAX_IMPORT_BYTES) throw new Error(`Die Datei ist grösser als 15 MB (${formatBytes(f.size)}).`);
      const mime = await detectMime(f);
      if (!mime) throw new Error("Nur PDF, JPG, PNG oder WEBP werden unterstützt. Der Dateiinhalt passt nicht zum Typ.");
      const path = `uploads/${menuCardId}/${crypto.randomUUID()}.${MIME_EXT[mime]}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: mime, upsert: false });
      if (error) throw new Error("Die Datei konnte nicht hochgeladen werden.");
      const res = await register({ data: { menuCardId, storagePath: path, originalName: f.name, contentType: mime } });
      return res.jobId;
    },
    onSuccess: (jobId) => {
      toast.success("Dokument bereitgestellt. Die Analyse startet erst auf Knopfdruck.");
      setFile(null);
      onCreated(jobId);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload fehlgeschlagen."),
  });

  const download = useMutation({
    mutationFn: async (u: string) => (await fromUrl({ data: { menuCardId, url: u } })).jobId,
    onSuccess: (jobId) => {
      toast.success("Dokument vom Link geladen. Die Analyse startet erst auf Knopfdruck.");
      setUrl("");
      onCreated(jobId);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Der Link konnte nicht geladen werden."),
  });

  const busy = upload.isPending || download.isPending;

  function pick(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    setFile(f);
  }

  return (
    <Tabs defaultValue="file" className="w-full">
      <TabsList>
        <TabsTrigger value="file"><FileUp className="mr-1 size-4" /> Datei hochladen</TabsTrigger>
        <TabsTrigger value="url"><Link2 className="mr-1 size-4" /> Von Link laden</TabsTrigger>
      </TabsList>

      <TabsContent value="file" className="mt-4 space-y-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files); }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center text-sm transition-colors ${dragging ? "border-primary bg-accent/40" : "border-border hover:bg-muted/40"}`}
        >
          <FileUp className="mb-2 size-6 text-muted-foreground" />
          <p className="font-medium">Speisekarte als PDF oder Bild hierher ziehen</p>
          <p className="mt-1 text-xs text-muted-foreground">PDF, JPG, PNG oder WEBP · maximal 15 MB · wird privat gespeichert</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => pick(e.target.files)}
          />
        </div>
        {file && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span className="truncate"><span className="font-medium">{file.name}</span> <span className="text-muted-foreground">· {formatBytes(file.size)}</span></span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setFile(null)} disabled={busy}>Entfernen</Button>
              <Button size="sm" onClick={() => upload.mutate(file)} disabled={busy}>
                {upload.isPending && <Loader2 className="size-4 animate-spin" />} Hochladen
              </Button>
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="url" className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="import-url">Direkter Link zur Speisekarte (PDF oder Bild)</Label>
          <div className="flex gap-2">
            <Input
              id="import-url"
              type="url"
              inputMode="url"
              placeholder="https://www.kundelfingerhof.ch/…/speisekarte.pdf"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={busy}
            />
            <Button onClick={() => download.mutate(url.trim())} disabled={busy || !url.trim()}>
              {download.isPending && <Loader2 className="size-4 animate-spin" />} Laden
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Aus Sicherheitsgründen nur HTTPS-Links von {ALLOWED_URL_HOSTS.join(" oder ")}. Der Download erfolgt serverseitig; es wird keine Webseite analysiert.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
