// 寄活動通知信給該活動所有報名者（先 console.log 內容，之後再接真正的寄信服務）
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { event_id, subject, message } = await req.json()

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const { data: regs, error } = await supabase
      .from("registrations")
      .select("name, email")
      .eq("event_id", event_id)
    if (error) throw error

    for (const r of regs ?? []) {
      console.log(`TO: ${r.email}\nSUBJECT: ${subject}\n\n${r.name} 您好，\n${message}`)
    }

    return new Response(JSON.stringify({ sent: regs?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
