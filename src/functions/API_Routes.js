import Express from "express";
import bodyParser from "body-parser";
import { QueryChat } from "./ollamaQuery.js";
import dbClient from "./dataBase_Client.js";
import { dataBase_methods } from "./dataBase_Client.js";
import { Ts_matching_Ratings } from "./ts_validation.js";

const API_router = Express.Router();

API_router.use(bodyParser.json());
API_router.use(bodyParser.urlencoded({ extended: false }));

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
		console.error(err);
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
						(
							CASE
							WHEN "一般生招生名額" = 0 THEN 
								NULL
							ELSE
								(
									(
										cast ("一般生招生名額" AS DOUBLE PRECISION) -
										cast ("一般生名額空缺" AS DOUBLE PRECISION)
									) /
									cast ("一般生招生名額" AS DOUBLE PRECISION)
								)
							END
						) AS 甄選一般生錄取率,
						"Data_${int_Year}"."r_score" AS "年度 R-Score"
						
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
		const data = q.rows.map((x) => {
			return { [x["校系代碼"]]: x };
		})[0];

		let chat_Res = await QueryChat(int_Year, data, target, "");
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
API_router.post("/getRelationData", async (req, res) => {
	try {
		const relations = await dataBase_methods.getRelationData(req.body);
		res.status(200).json(relations);
	} catch (err) {
		res.status(404).send("404 Error no data.");
		console.error(err.message);
	}
});

/*
  year = the target year
  id = school ID
*/
API_router.post("/getSummaryData", async (req, res) => {
	try {
		const { body } = req;
		const [source_Cols, target_Cols] =
			await dataBase_methods.getDepartCodeInTargetYear(body);

		//- columns
		const targets = [
			source_Cols.map((sc) =>
				dataBase_methods.getSummaryData({ ...body, departmentCodes: [sc] })
			),
			target_Cols.map((tg) =>
				dataBase_methods.getSummaryData({
					...body,
					year: body.year_TG,
					departmentCodes: [tg],
				})
			),
		];
		const targetsMap = targets.map((x) => Promise.all(x));
		const [sc_summary, tg_summary] = await Promise.all(targetsMap);

		res.status(200).json({
			source: sc_summary,
			target: tg_summary,
		});
	} catch (err) {
		res.status(404).send("404 Error no data.");
		console.error(err.message);
	}
});


export default API_router;
