import app from "./src/app.js";
import { loadAllPlugins } from "./src/core.js";

const PORT = process.env.PORT || 3000;

await loadAllPlugins();

app.listen(PORT, () => {
  console.log(`API ready at http://localhost:${PORT}`);
  console.log(`UI playground at http://localhost:${PORT}`);
});