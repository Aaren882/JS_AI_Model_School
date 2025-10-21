import { Pool } from "pg";
import SchoolQueue from "../objects/schoolQueue.js";
import { QueryViews } from "./DB/createDBViews.js";
import {
	Ts_matching_Ratings_Array,
} from "./ts_validation.js";

//- Make sure DB is connected
console.log("Connecting Database...");

let dbClient = null;
if (!dbClient) {
	/* dbClient = new Client({
    host : 'localhost',
    user: 'postgres',
    password: process.env.DB_PW,
    database: 'School_Test',
    port: 5432,
  }); */

	const pool = new Pool({
		host: process.env.DB_IP,
		user: "postgres",
		password: process.env.DB_PW,
		database: "School_Test",
		port: process.env.DB_PORT,
	});

	try {
		dbClient = await pool.connect();
		console.log("\x1b[42mDatabase Connected.\x1b[0m \n");
	} catch (error) {
		//- The error is "AggregateError"
		console.log(`\x1b[41mCannot connect to Database !!\x1b[0m \n`);
		error.errors.forEach((x) => {
			console.error(`Database Error - \"\x1b[31m${x.message}\x1b[0m\"`);
		});
	}
}
export default dbClient;

//- #NOTE :  DEPRECATED
/* function getPrompt(year = "0", post = "") {
	return `
    SELECT 
      "校系代碼" as id,
      "學校" as name,
      "正備取有效性" as posvalid
    FROM public."Data_${year}"
    where "正備取有效性" != 0 ${post}
  `;
export class SchoolDB_Client {
	SchoolQueue = new SchoolQueue();

	//- Get DB school
	getAnalyzeSchools(year = "") {
		const query = getPrompt(year, "LIMIT 50");

		return new Promise((resolve, reject) => {
			dbClient
				.query(query)
				.then((_res) => {
					//- Add to school
					_res.rows.forEach((obj) => {
						if (obj) {
							this.SchoolQueue.AddSchool(obj);
						}
						resolve(this.SchoolQueue);
					});
				})
				.catch((err) => {
					console.error(err.message);
					reject(err.message);
				});
		});
	}
} */

export class dataBase_methods {
	static async initDatabase(year = 111) {
		const query_TableName = `QUERY_${year}${process.env.QUERY_POSTFIX || ""}`;
		const query = {
			text: `
        SELECT 
          cast (COUNT (*) AS Integer)
        FROM information_schema.views
        WHERE table_name LIKE '${query_TableName}'
      `,
			rowMode: "array",
		};

		console.log(`📄 \x1b[33m- Checking ${query_TableName} Tables.\x1b[0m`);

		//- Check table exist
		try {
			let res = await dbClient.query(query);

			if (res.rows[0] != 1) await Promise.all([QueryViews(year)]);

		} catch (err) {
			console.error(err);
		} finally {
			console.log(
				`\x1b[32m✅ - All \"${year}\" VIEW Tables has been checked !!\x1b[0m \n`
			);
		}
	}

	/* 
    Query from view tables for better performance
  */
	static async getAllSchool(year_Int = -1) {
		const query = `
      SELECT *
      FROM public."QUERY_${year_Int}${process.env.QUERY_POSTFIX || ""}"
    `;

		try {
			let res = await dbClient.query(query);
			return res.rows;
		} catch (err) {
			console.error(err.message);
		}
	}

	static async getRelationData(bodyData) {
		const { year = "", mode, departmentCodes, universityCode } = bodyData;
		const year_Int = parseInt(year);

		try {
			switch (mode) {
				case "school":
					//- getAllRelations for each department
					const query = {
						text: `
							SELECT 
								"deptcode"
							FROM public."QUERY_${year_Int}${process.env.QUERY_POSTFIX || ""}"
							WHERE "schoolcode" = \'${universityCode}\'
						`,
						rowMode: "array",
					};
					let res_nodes = await dbClient.query(query);
					return Ts_matching_Ratings_Array(year_Int, res_nodes.rows.flat());

				default:
					return Ts_matching_Ratings_Array(year_Int, departmentCodes);
			}
		} catch (err) {
			console.error(err);
		}
	}

	static async getSummaryData(bodyData) {
		const { year = "", mode, departmentCodes } = bodyData;
		const year_Int = parseInt(year);

		try {
			let query_Summary, res_Sum;
			const res_nodes = await dataBase_methods.getRelationData(bodyData);
			switch (mode) {
				case "school":
					//- Summarize Schools into average values
					query_Summary = `
						SELECT 
							schoolcode,
							schoolname,
							AVG("posvalid") AS "posvalid",
							AVG("admissionvalidity") AS "admissionvalidity",
							AVG("admissonrate") AS "admissonrate",
							AVG("r_score") AS "r_score",
							AVG("shiftratio") AS "shiftratio",
							AVG("avg") AS "avg"
						FROM public."QUERY_${year_Int}${process.env.QUERY_POSTFIX || ""}"
						WHERE "schoolcode" in (
							\'${res_nodes["nodes"].map((x) => x[0].slice(0, 3)).join("','")}\'
						)
						GROUP BY 
							"schoolcode",
							"schoolname"
					`;

					res_Sum = await dbClient.query(query_Summary);
					return res_Sum.rows;

				default:
					//- Summarize departments into average values
					query_Summary = `
						SELECT 
							deptcode,
							deptname,
							schoolname,
							AVG("posvalid") AS "posvalid",
							AVG("admissionvalidity") AS "admissionvalidity",
							AVG("admissonrate") AS "admissonrate",
							AVG("r_score") AS "r_score",
							AVG("shiftratio") AS "shiftratio",
							AVG("avg") AS "avg"
						FROM public."QUERY_${year_Int}${process.env.QUERY_POSTFIX || ""}"
						WHERE "deptcode" in (
							\'${res_nodes["nodes"].map((x) => x[0]).join("','")}\'
						)
						GROUP BY 
							"deptcode",
							"deptname",
							"schoolname"
					`;
					res_Sum = await dbClient.query(query_Summary);
					return res_Sum.rows;
			}
		} catch (err) {
			console.error(err);
		}
	}

	//- Get all the match data in pairs. (#NOTE : it's without draw !!!)
	static async getAllMatches(year_Int = -1) {
		const query = {
			text: `
				SELECT 
					CAST (WINNER AS text),
					CAST (LOSER AS text)
				FROM
				(
					SELECT 
						一 AS WINNER,
						unnest(array[
							二,
							三,
							四,
							五,
							六
						]) AS LOSER
					FROM public.admission_${year_Int}
				)
				WHERE 
					LOSER IS NOT NULL
			`,
			rowMode: "array",
		};

		try {
			let res = await dbClient.query(query);
			return res.rows;
		} catch (err) {
			console.error(err.message);
		}
	}
	//- This only outputs draw arrays (it should have less)
	static async getAllMatches_Draws(year_Int = -1) {
		const query = {
			text: `
				SELECT 
					CAST (WINNER AS text),
					CAST (LOSER AS text)
				FROM
				(
					SELECT 
						二 AS WINNER,
						unnest(array[
							三,
							四,
							五,
							六
						]) AS LOSER
					FROM public.admission_${year_Int}
				)
				WHERE 
					LOSER IS NOT NULL
			`,
			rowMode: "array",
		};

		try {
			let res = await dbClient.query(query);
			return res.rows;
		} catch (err) {
			console.error(err.message);
		}
	}
	//- This only outputs arrays of "[winner<STRING>, loser<STRING>, isDraw<BOOL>]"
	static async getAllMatches_FullDetail(year_Int = -1) {
		const query = {
			text: `
			(
				SELECT 
					CAST (WINNER AS text),
					CAST (LOSER AS text),
					false AS isDraw
				FROM
				(
					SELECT 
						一 AS WINNER,
						unnest(array[
							二,
							三,
							四,
							五,
							六
						]) AS LOSER
					FROM public.admission_${year_Int}
				)
				WHERE 
					LOSER IS NOT NULL
			) UNION (
				SELECT 
					CAST (WINNER AS text),
					CAST (LOSER AS text),
					true AS isDraw
				FROM
				(
					SELECT 
						二 AS WINNER,
						unnest(array[
							三,
							四,
							五,
							六
						]) AS LOSER
					FROM public.admission_${year_Int}
				)
				WHERE 
					LOSER IS NOT NULL
			)
			`,
			rowMode: "array",
		};

		try {
			let res = await dbClient.query(query);
			return res.rows;
		} catch (err) {
			console.error(err.message);
		}
	}
}
