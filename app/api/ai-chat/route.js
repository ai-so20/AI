import { runAiCommunityTick } from "../../lib/ai-community";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await runAiCommunityTick({
    source: "human_message",
    bypassMinuteClaim: false,
  });

  return Response.json(result, { status: result?.success === false ? 500 : 200 });
}
