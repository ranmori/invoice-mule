import { createServer } from "node:http";
import { yoga } from "./yoga.js";

const port = Number(process.env.PORT ?? 4000);

createServer(yoga).listen(port, () => {
  console.log(`Invoice Mule API on http://localhost:${port}/graphql`);
});
