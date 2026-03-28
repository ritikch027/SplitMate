import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userIds, notification } = await req.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return jsonResponse(
        { error: "userIds is required.", code: "missing_user_ids" },
        400,
      );
    }

    if (!notification?.title || !notification?.body) {
      return jsonResponse(
        {
          error: "notification.title and notification.body are required.",
          code: "invalid_notification_payload",
        },
        400,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("token")
      .in("userId", uniqueUserIds);

    if (tokenError) throw tokenError;

    const uniqueTokens = [
      ...new Set((tokens || []).map((item) => item.token).filter(Boolean)),
    ];

    if (!uniqueTokens.length) {
      return jsonResponse({
        success: true,
        sent: 0,
        message: "No push tokens found.",
      });
    }

    const results = [];
    let totalSent = 0;

    for (let index = 0; index < uniqueTokens.length; index += CHUNK_SIZE) {
      const chunk = uniqueTokens.slice(index, index + CHUNK_SIZE);

      const messages = chunk.map((token) => ({
        to: token,
        sound: "default",
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        channelId: "default",
      }));

      const expoResponse = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}`,
        },
        body: JSON.stringify(messages),
      });

      const result = await expoResponse.json();
      results.push(result);

      console.log("Expo response:", JSON.stringify(result, null, 2));

      // 🔥 CLEANUP LOGIC (THIS IS WHAT YOU WANTED)
      if (result?.data) {
        for (let i = 0; i < result.data.length; i++) {
          const item = result.data[i];
          const token = chunk[i];

          if (item.status === "error") {
            if (item.details?.error === "DeviceNotRegistered") {
              console.log("Removing invalid token:", token);

              await supabase.from("push_tokens").delete().eq("token", token);
            }
          }
        }
      }

      if (!expoResponse.ok) {
        console.error("Expo push failed:", JSON.stringify(result, null, 2));

        return jsonResponse(
          {
            success: false,
            sent: totalSent,
            error: "Expo Push API request failed.",
            code: "expo_push_request_failed",
            result,
          },
          500,
        );
      }

      totalSent += messages.length;
    }

    return jsonResponse({
      success: true,
      sent: totalSent,
      results,
    });
  } catch (error) {
    console.error("send-push-notifications error:", error);

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        code: "unexpected_error",
      },
      500,
    );
  }
});
