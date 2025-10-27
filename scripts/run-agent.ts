import "dotenv/config";
import "tsconfig-paths/register";
import { runAgent } from "@/lib/agent";

async function main() {
  const summary = await runAgent();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
