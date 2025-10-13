import Express, { text } from "express";
import showdown from "showdown";
import { QueryChat } from "./ollamaQuery.js";
import dbClient from "./dataBase_Client.js";
import { dataBase_methods } from "./dataBase_Client.js";
import { Ts_matching_Ratings } from "./ts_validation.js";

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

	try {
		const relations = await Ts_matching_Ratings(int_Year, schoolID);
		const nodes = relations.nodes.map((x) => x[0]).join(",");
		if (nodes === "") throw `API error \"getSchoolAnalyze\" no Nodes were found !!!`;

		//- Asking AI
		const query = {
			text: `
				SELECT 
					"校系代碼",
					"Data_${int_Year}".學校名稱,
					"Data_${int_Year}".系科組學程名稱,
					"Distr_${int_Year}".招生名額 AS 統測登記分發招生名額,
					"Distr_${int_Year}".錄取人數 AS 統測登記分發錄取人數,
					COALESCE(
						"Distr_${int_Year}".錄取總分數 /
						(
							"Distr_${int_Year}".國文 +
							"Distr_${int_Year}".英文 +
							"Distr_${int_Year}".數學 +
							"Distr_${int_Year}".專業一 +
							"Distr_${int_Year}".專業二
						)
						, -1) AS 統測登記分發錄取平均分數,
						
						"Data_${int_Year}"."正取總人數" AS 甄選一般生正取總人數,
						"Data_${int_Year}"."備取總人數" AS 甄選一般生備取總人數,
						"Data_${int_Year}"."一般生正取錄取人數" AS 甄選一般生正取錄取人數,
						"Data_${int_Year}"."一般生備取錄取人數" AS 甄選一般生備取錄取人數,
						"Data_${int_Year}"."一般生名額空缺" AS 甄選一般生名額空缺,
						"Data_${int_Year}"."一般生招生名額" AS 甄選一般生招生名額,
						"Data_${int_Year}"."報到人數" AS 甄選一般生報到人數,
						"Data_${int_Year}"."正備取有效性" AS 甄選一般生正備取有效性,
						"Data_${int_Year}"."甄選名額流去登分比例" AS 甄選名額流去登分比例,
						"Data_${int_Year}"."r_score"
						
				FROM Public."Distr_${int_Year}"
				RIGHT JOIN Public."Data_${int_Year}" ON 
					"Data_${int_Year}".學校名稱 LIKE "Distr_${int_Year}".學校名稱 AND
					POSITION("Data_${int_Year}".系科組學程名稱 IN "Distr_${int_Year}".系科組學程名稱) > 0 AND
					"Distr_${int_Year}".群別代號 LIKE "Distr_${int_Year}".群別代號
				WHERE "Data_${int_Year}"."校系代碼" IN (${nodes})
				ORDER BY "r_score" DESC
			`,
		};
		let q = await dbClient.query(query);
		const target = q.rows.find((x) => int_ID === x["校系代碼"]);

		//- Construct data format
		// const data = {};
		// q.rows.forEach((elem) => {
		// 	let { id, name, posvalid } = elem;
		// 	data[id] = {
		// 		name: name,
		// 		posvalid: posvalid,
		// 	};
		// });
		
		const data = q.rows.map((x) => {
			return { [x["校系代碼"]]: x };
		})[0];
		let chat_Res = await QueryChat(int_Year, data, target, "");
		// chat_Res = showdownCt.makeHtml(chat_Res.message.content);
		res.status(200).json({ chat: chat_Res.message.content });
	} catch (err) {
		res.status(404).send("404 Error no data.");
		console.error(err);
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

		const relations = await Ts_matching_Ratings(year_Int, id);

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
