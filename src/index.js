import "dotenv/config";
import Express from "express";
import path from "path";

import API_router from "./functions/API_Routes.js";
import { dataBase_methods } from "./functions/dataBase_Client.js";

//- TEST
await dataBase_methods.initDatabase();
//- ------ -//

const __dirname = process.cwd() + "/src/views";

const app = Express();

app.use("/api", API_router);
app.use(Express.static(path.join(__dirname, "public"))); // 👈#NOTE : 這會把 html 改成固定的

//- set views
app.set("view engine", process.env.VIEW_ENGINE);
app.set("views", __dirname);

//- Env port
const port = parseInt(process.env.PORT || "3000");
app.listen(port, () => {
	console.log(`\x1b[46m Server started !!\x1b[0m`);
	console.log(` - on\x1b[33m http://localhost:${port}\x1b[0m`);
});
