import { runPipeline } from '../lib/pipeline';

async function main() {
  const result = await runPipeline('what is a transformer', []);
  console.log(JSON.stringify(result, null, 2));
}

main();
