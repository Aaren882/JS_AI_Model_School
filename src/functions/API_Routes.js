import Express from "express";
import showdown from "showdown";
import { QueryChat } from "./ollamaQuery.js";
import dbClient from "./dataBase_Client.js";
import { dataBase_methods } from "./dataBase_Client.js";
import { Ts_data } from "./ts_validation.js";

const showdownCt = new showdown.Converter(); //- MD convertor
const API_router = Express.Router();

/*
  year = the target year
*/
API_router.get("/getAllSchool", async (req, res) => {
	let { year = "0" } = req.query;
	let year_Int = parseInt(year);

	if (year_Int === 0) {
		res.status(404).send("404 Error no data.");
		return;
	}

	try {
		//- Responses
		let _res = await dataBase_methods.getAllSchool(year_Int);
		res.status(200).json(_res);
	} catch (err) {
		res.status(404).send("404 Error no data.");
		console.error(err.message);
	}
});

/*
  #TODO - More types of aspect analyze (School, department, group)

  year = the target year
  schoolID = `schoolID` that getting analyzed
*/
API_router.get("/getSchoolAnalyze", async (req, res) => {
	let { year = "0", schoolID = "" } = req.query;

	if (year === "0" || schoolID === "") {
		res.status(404).send("404 Error no data.");
		return;
	}
	let int_Year = parseInt(year);
	let int_ID = parseInt(schoolID);

	const query = `SELECT 
    "校系代碼" as id,
    "學校" as name,
    "正備取有效性" as posvalid
  FROM public."Data_${int_Year}"
  where 
    ("正備取有效性" != 0) AND
    ("校系代碼" = ${int_ID})`;

	try {
		//- Asking AI
		let q = await dbClient.query(query);

		//- Construct data format
		const data = {};
		q.rows.forEach((elem) => {
			let { id, name, posvalid } = elem;
			data[id] = {
				name: name,
				posvalid: posvalid,
			};
		});
		let chat_Res = await QueryChat(`${data}`, "這間學校很受歡迎嗎?");

		chat_Res = showdownCt.makeHtml(chat_Res.message.content);
		res.status(200).json({ chat: chat_Res });
	} catch (err) {
		res.status(404).send("404 Error no data.");
		console.error(err.message);
	}
});

/*
  year = the target year
  id = school ID
*/
API_router.get("/getRelationData", async (req, res) => {
	try {
		let { year, id } = req.query;
		let year_Int = parseInt(year);

		const ts_data = await Ts_data(year_Int);
		const relations = ts_data.getLevelNodes(id);

		res.status(200).json(relations);
	} catch (err) {
		res.status(404).send("404 Error no data.");
		console.error(err.message);
	}
});

/*
  #TODO - Not working yet (maybe not needed)
  id = school id
*/
API_router.get("/getSchoolDeparts", (req, res) => {
	let { id } = req.query;
	let id_Int = parseInt(id);
	console.log(id);
	res.status(200);
	res.send(id_Int);
});

export default API_router;
