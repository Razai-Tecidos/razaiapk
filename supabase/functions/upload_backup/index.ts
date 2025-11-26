import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const UPLOAD_TOKEN = Deno.env.get("UPLOAD_TOKEN");
const BUCKET = Deno.env.get("BACKUP_BUCKET") || "backups";
const MANIFEST_ID = Number(Deno.env.get("MANIFEST_ID") || "1");

if (!SUPABASE_URL || !SERVICE_KEY || !UPLOAD_TOKEN) {
  console.log("[upload_backup] Missing required environment variables.");
}

// CORS headers para permitir chamada do browser (preflight + POST)
const corsHeaders: Record<string,string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-upload-token, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400"
};

serve(async (req: Request) => {
  // Preflight CORS: devolver 204 sem corpo
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const token = req.headers.get("x-upload-token");
    if (!token || token !== UPLOAD_TOKEN) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    if (!req.headers.get("content-type")?.includes("application/json")) {
      return new Response("Invalid content type", { status: 400, headers: corsHeaders });
    }

    const body = await req.json();
    const { backupJson, hash, sizeBytes } = body || {};
    if (!backupJson || typeof hash !== "string") {
      return new Response("Missing backupJson or hash", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!);

    const serialized = JSON.stringify(backupJson);
    const blob = new Blob([serialized], { type: "application/json" });

    // Upload latest.json (upsert)
    const latestRes = await supabase.storage
      .from(BUCKET)
      .upload("latest.json", blob, { upsert: true });
    if (latestRes.error) {
      return new Response(`Storage latest error: ${latestRes.error.message}`, { status: 500, headers: corsHeaders });
    }

    // Snapshot
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const snapPath = `snapshots/backup-${ts}.json`;
    const snapRes = await supabase.storage.from(BUCKET).upload(snapPath, blob);
    if (snapRes.error) {
      return new Response(`Storage snapshot error: ${snapRes.error.message}`, { status: 500, headers: corsHeaders });
    }

    // Upsert manifest (permite primeira escrita sem linha pré-existente)
    const manifestRes = await supabase
      .from("backups_manifest")
      .upsert({ id: MANIFEST_ID, hash, size_bytes: sizeBytes ?? serialized.length, updated_at: new Date().toISOString(), version: 4 }, { onConflict: "id" });

    if (manifestRes.error) {
      // Se tabela não existe, retornar sucesso parcial para não bloquear backup principal
      const msg = manifestRes.error.message || "unknown";
      if (/could not find the table/i.test(msg)) {
        console.warn("[upload_backup] Manifest table missing; backup stored but manifest not updated.");
        return new Response(JSON.stringify({ ok: true, hash, snapshot: snapPath, manifestSkipped: true, reason: msg }), {
          status: 200,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }
      return new Response(`Manifest update error: ${msg}`, { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true, hash, snapshot: snapPath }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`, { status: 500, headers: corsHeaders });
  }
});
