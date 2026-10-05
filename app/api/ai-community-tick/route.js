import { runAiCommunityTick } from "../../lib/ai-community";

export const dynamic = "force-dynamic";

async function run() {
  const result = await runAiCommunityTick({
    source: "community_tick",
    bypassMinuteClaim: false,
  });

  return Response.json(result, { status: result?.success === false ? 500 : 200 });
}

export async function GET() {
  return run();
}

export async function POST() {
  return run();
}
