import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { memberId } = await req.json();

    if (!memberId) {
      return new Response(
        JSON.stringify({ error: "memberId gerekli" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: aidatCategoryData } = await supabase
      .from("transaction_categories")
      .select("id")
      .eq("name", "Aidat")
      .eq("type", "income")
      .maybeSingle();

    if (!aidatCategoryData) {
      return new Response(
        JSON.stringify({ error: "Aidat kategorisi bulunamadı" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const aidatCategoryId = aidatCategoryData.id;

    const { data: aidatPayments } = await supabase
      .from("transactions")
      .select("id, amount, transaction_date")
      .eq("member_id", memberId)
      .eq("category_id", aidatCategoryId)
      .eq("type", "income")
      .order("transaction_date", { ascending: true });

    const { data: pendingDues } = await supabase
      .from("dues")
      .select("id, amount, due_date, period_year, period_month")
      .eq("member_id", memberId)
      .eq("status", "pending")
      .order("due_date", { ascending: true });

    if (!aidatPayments || aidatPayments.length === 0) {
      return new Response(
        JSON.stringify({ message: "Aidat ödemesi bulunamadı", offsetCount: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!pendingDues || pendingDues.length === 0) {
      return new Response(
        JSON.stringify({ message: "Bekleyen tahakkuk bulunamadı", offsetCount: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let totalPayment = aidatPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    let offsetCount = 0;
    const updates = [];

    for (const due of pendingDues) {
      if (totalPayment <= 0) break;

      const dueAmount = Number(due.amount);
      if (totalPayment >= dueAmount) {
        updates.push({
          id: due.id,
          status: "paid",
          paid_date: new Date().toISOString().split("T")[0],
        });
        totalPayment -= dueAmount;
        offsetCount++;
      }
    }

    if (updates.length > 0) {
      for (const update of updates) {
        await supabase
          .from("dues")
          .update({ status: update.status, paid_date: update.paid_date })
          .eq("id", update.id);
      }
    }

    return new Response(
      JSON.stringify({
        message: `${offsetCount} aidat tahakkuku mahsup edildi`,
        offsetCount,
        remainingPayment: totalPayment,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});