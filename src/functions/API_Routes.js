import Express from "express";
import bodyParser from "body-parser";
import dbClient from "./DB/dataBase_Client.js";
import { postfix, dataBase_methods } from "./DB/dataBase_Client.js";
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

	let [GroupData, departmentData, SchoolData] = await Promise.all([
		dataBase_methods.getAllGroup(year_Int),
		dataBase_methods.getAllDepartment(year_Int),
		dataBase_methods.getAllSchool(year_Int),
	]);
	
	try {
		//- Responses
		res.status(200).json({
			GroupData,
			departmentData,
			SchoolData
		});
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
API_router.post("/getSchoolAnalyze", async (req, res) => {
	const { body } = req;
	const { year = ""} = body;

	if (year === "") {
		res.status(404).send("404 Error no data.");
		return;
	}

	try {
		
		const message = await dataBase_methods.getSchoolAnalyze(body);
		// if (nodes === "") throw `API error \"getSchoolAnalyze\" no Nodes were found !!!`;
		
		res.status(200).json({ chat: message });
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
