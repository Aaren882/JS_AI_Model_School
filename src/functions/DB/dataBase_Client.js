import { Pool } from "pg";
import {
	QueryAdmissionViews,
	QueryInitViews,

	QueryViews,
	QueryViews_School,
	QueryViews_Department,

	QueryCompetitionViews_School,
	QueryCompetitionViews_Department,

	Query_R_table_School,
	Query_R_table_Department,
} from "./createDBViews.js";
import {
	Ts_matching_Ratings_Array,
	Ts_matching_Ratings_Query
} from "../ts_validation.js";

//- Make sure DB is connected
console.log("Connecting Database...");

const postfix = process.env.QUERY_POSTFIX || "";
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
		database: process.env.DB_DATABASE || "School_Test",
		port: process.env.DB_PORT,
	});

	//- Initialization
	try {
		dbClient = await pool.connect();

		//- Check table existence
		pool.on('connect', async (client) => {
			
		})

		console.log("\x1b[42mDatabase Connected.\x1b[0m \n");
	} catch (error) {
		//- The error is "AggregateError"
		console.log(`\x1b[41mCannot connect to Database !!\x1b[0m \n`);
		error.errors.forEach((x) => {
			console.error(`Database Error - \"\x1b[31m${x.message}\x1b[0m\"`);
		});
	}
}

//-Exports
export default dbClient;
export function initServerData(years = []) {
	return Promise.all(years.map((x) => dataBase_methods.initDatabase(x)));
};
export class dataBase_methods {
	static async initDatabase(year = 111) {
		
		const INIT_List = [
			"init",
			"admission",
			"",

			"competition_school",
			"competition_department",
			
			//- R-Tables
			"R_table_school",
			"R_table_department",

			//- Summarized data (schools, departments...)
			"school",
			"department",
		];

		//- #NOTE : Asynchronous matters, tables are dependence
		for (const x of INIT_List) {
			await this.initCreateDatabase(year, x);
		}
		console.log(
			`\x1b[32m✅ - All \"${year}\" VIEW Tables has been checked !!\x1b[0m \n`
		);
	}
	static async initCreateDatabase(year = 111, TableName = "") {
		const query_TableName = `QUERY_${year}${
			(TableName !== "" ? "_" : "") + TableName
		}${postfix}`;

		const query = {
			text: `
        SELECT 
          cast (COUNT (*) AS Integer)
        FROM pg_matviews
        WHERE matviewname LIKE '${query_TableName}'
      `,
			rowMode: "array",
		};

		console.log(`📄 \x1b[33m- Checking \"${query_TableName}\" Tables.\x1b[0m`);

		//- Check table exist
		try {
			let res = await dbClient.query(query);

			if (res.rows[0] != 1) {
				switch (TableName) {
					case "init": //- Initial computation Data
						await QueryInitViews(year, query_TableName);
						break;
					case "admission":
						await QueryAdmissionViews(year, query_TableName);
						break;
					case "competition_school": //- Competition for schools
						await QueryCompetitionViews_School(year, query_TableName);
						break;
					case "competition_department": //- R-scores for departments
						await QueryCompetitionViews_Department(year, query_TableName);
						break;

					case "R_table_school": //- R-scores for schools
						await Query_R_table_School(year, query_TableName);
						break;
					case "R_table_department": //- R-scores for departments
						await Query_R_table_Department(year, query_TableName);
						break;

					//- Summarized Tables
					case "school":
						await QueryViews_School(year, query_TableName);
						break;
					case "department":
						await QueryViews_Department(year, query_TableName);
						break;
					default:
						await QueryViews(year, query_TableName);
						break;
				};
				console.log(
					`  ✅\x1b[32m-- Successfully create \"${query_TableName}\" view.👁️\x1b[0m`
				);
				await new Promise((resolve) => setTimeout(resolve, 500));
			};
		} catch (err) {
			console.error(err);
		}
	}

	/* 
    Query from view tables for better performance
  */
	static async getAllGroup(year_Int = -1) {
		const query = `
      SELECT 
				schoolcode,
				schoolname,
				deptcode,
				deptname,
				category,
				admissionvacancies,
				acceptancenumber,
				totalacceptancenumber,
				admissionnumber,
				totaladmissionnumber,
				posvalid,
				admissionrate,
				shiftratio,
				admissionvalidity,
				r_score,
				"avg"
			FROM public."QUERY_${year_Int}${postfix}"
    `;

		try {
			let res = await dbClient.query(query);
			return res.rows;
		} catch (err) {
			console.error(err.message);
		}
	}
	static async getAllDepartment(year_Int = -1) {
		const query = `
      SELECT *
			FROM public."QUERY_${year_Int}_department${postfix}"
    `;

		try {
			let res = await dbClient.query(query);
			return res.rows;
		} catch (err) {
			console.error(err.message);
		}
	}
	static async getAllSchool(year_Int = -1) {
		const query = `
      SELECT *
			FROM public."QUERY_${year_Int}_school${postfix}"
    `;

		try {
			let res = await dbClient.query(query);
			return res.rows;
		} catch (err) {
			console.error(err.message);
		}
	}

	static async getRelationData_Local(bodyData) {
		const { year = "", mode, departmentCodes, universityCode } = bodyData;
		const year_Int = parseInt(year);

		let query;
		try {
			switch (mode) {
				case "school":
					//- getAllRelations for each department
					query = {
						text: `
						SELECT
							winner,
							loser,
							array_agg(isdraw) AS results,
							COUNT (*) AS relationCount
						FROM (
							SELECT
								SUBSTRING(winner,1,3) AS winner,
								SUBSTRING(loser,1,3) AS loser,
								isdraw
							FROM public.\"QUERY_${year_Int}_admission${postfix}\"
							WHERE
								winner LIKE '${universityCode}%' OR
								loser LIKE '${universityCode}%'
						)
						WHERE
							(winner != loser) 
						GROUP BY
							winner,
							loser
						`,
						rowMode: "array",
					};
					break;

				default:
					let stringify = departmentCodes.join("','");
					query = {
						text: `
							SELECT
								winner,
								loser,
								array_agg(isdraw),
								COUNT (*) AS relationCount
							FROM public.\"QUERY_${year_Int}_admission${postfix}\"
							WHERE
								winner in (\'${stringify}\') OR
								loser in (\'${stringify}\')
							GROUP BY
								winner,
								loser
						`,
						rowMode: "array",
					};
					break;
			}
			const res_nodes = await dbClient.query(query);
			return Ts_matching_Ratings_Array(year_Int, res_nodes.rows);

		} catch (err) {
			console.error(err);
		}
	}
	static async getRelationData(bodyData) {
		const { year = "", mode, departmentCodes, universityCode, departmentName } = bodyData;
		const year_Int = parseInt(year);

		let query, stringify='';
		try {
			switch (mode) {
				case "school":
					//- getAllRelations for each department
					query = {
						text: `
							SELECT *
							FROM public.\"QUERY_${year}_competition_school${postfix}\"
							WHERE
								winner = '${universityCode}' OR
								loser = '${universityCode}'
						`,
						rowMode: "array",
					};
					break;
				
				case "department":
					stringify = [universityCode, departmentName].join("-");
					query = {
						text: `
						SELECT
								winner,
								loser,
								results,
								relationcount
							FROM public.\"QUERY_${year_Int}_competition_department${postfix}\"
							WHERE
								winner = \'${stringify}\' OR
								loser = \'${stringify}\'
						`,
						rowMode: "array",
					};
					break;
				
				default:
					stringify = departmentCodes.join("','");
					query = {
						text: `
							SELECT
								winner,
								loser,
								array_agg(isdraw),
								COUNT (*) AS relationCount
							FROM public.\"QUERY_${year_Int}_admission${postfix}\"
							WHERE
								winner in (\'${stringify}\') OR
								loser in (\'${stringify}\')
							GROUP BY
								winner,
								loser
						`,
						rowMode: "array",
					};
					break;
			}
			const { rows } = await dbClient.query(query);
			return Ts_matching_Ratings_Query(year_Int, rows, mode);
		} catch (err) {
			console.error(err);
		}
	}

	static async getDepartCodeInTargetYear(bodyData) {
		const {
			year = "",
			year_TG,
			mode,
			departmentCodes,
			universityCode,
			universityName,
		} = bodyData;

		const year_Int = parseInt(year);
		const year_TG_Int = parseInt(year_TG);
		
		let sc_query_Summary;
		switch (mode) {
			case "school":
				sc_query_Summary = `
				SELECT 
					SC_TB.schoolcode AS SC,
					TG_TB.schoolcode AS TG
				FROM public."QUERY_${year_Int}${postfix}" SC_TB
				JOIN
				(
					SELECT *
					FROM public."QUERY_${year_Int}${postfix}"
				) TG_TB
				ON SC_TB.schoolname = TG_TB.schoolname
				WHERE 
					SC_TB.schoolcode = \'${universityCode}\' AND
					SC_TB.schoolname = TG_TB.schoolname
				GROUP BY 
					SC_TB.schoolcode,
					TG_TB.schoolcode
				`;
				break;
			default:
				sc_query_Summary = `
				SELECT 
					SC_TB.deptcode AS \"SC\",
					TG_TB.deptcode AS \"TG\"
				FROM public."QUERY_${year_Int}${postfix}" SC_TB
				JOIN
				(
					SELECT *
					FROM public."QUERY_${year_TG_Int}${postfix}"
				) TG_TB
				ON SC_TB.schoolcode = TG_TB.schoolcode
				WHERE 
					SC_TB.deptcode IN (
						\'${departmentCodes.join("','")}\'
					) AND
					SC_TB.deptname = TG_TB.deptname AND
					SC_TB.category = TG_TB.category
				`;
				break;
		}

		try {
			let res = await dbClient.query({text: sc_query_Summary, rowMode: 'array'});

			//- Transform Data
			const result = [[], []];
			res.rows.forEach(([SC = "000000", TG]) => {
				result[0] = [...result[0], SC];
				result[1] = [...result[1], TG];
			});
			
			return result;
		} catch (error) {
			console.error(error);
		}
	}

	static async getSummaryData(bodyData) {
		const {
			year = "",
			mode,
		} = bodyData;
		const year_Int = parseInt(year);

		try {
			let tg_query_Summary, res_Sum;
			const res_nodes = await dataBase_methods.getRelationData(bodyData);

			switch (mode) {
				case "school":
					//- Summarize Schools into average values
					tg_query_Summary = `
						SELECT 
							schoolcode,
							schoolname,
							min("posvalid") AS "posvalid",
							min("admissionvalidity") AS "admissionvalidity",
							min("admissionrate") AS "admissionrate",
							min("r_score") AS "r_score",
							min("shiftratio") AS "shiftratio",
							min("avg") AS "AVG"
						FROM public."QUERY_${year_Int}${postfix}"
						WHERE "schoolcode" in (
							\'${res_nodes["nodes"].map((x) => x[0].slice(0, 3)).join("','")}\'
						)
						GROUP BY
							schoolcode,
							schoolname
					`;
					break;
				case "department":
					tg_query_Summary = `
						SELECT 
							schoolcode,
							schoolname,
							deptname,
							ARRAY_TO_STRING(categories, ',') AS category,
							"posvalid",
							"admissionrate",
							"r_score",
							"shiftratio",
							"avg"
						FROM public."QUERY_${year_Int}_department${postfix}"
						WHERE FORMAT('%s-%s', schoolcode, deptname) in (
							\'${res_nodes["nodes"].map((x) => x[0]).join("','")}\'
						)
					`;
					break;

				default:
					//- Summarize departments into average values
					tg_query_Summary = `
						SELECT 
							deptcode,
							deptname,
							category,
							schoolcode,
							schoolname,
							"posvalid",
							"admissionvalidity",
							"admissionrate",
							"r_score",
							"shiftratio",
							"avg"
						FROM public."QUERY_${year_Int}${postfix}"
						WHERE "deptcode" in (
							\'${res_nodes["nodes"].map((x) => x[0]).join("','")}\'
						)
					`;
					break;
			}
			res_Sum = await dbClient.query(tg_query_Summary);
			return res_Sum.rows;
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
	//- This only outputs arrays of "[winner<STRING>, loser<STRING>, isDraw<BOOL[]>]"
	static async getAllMatches_FullDetail(year_Int = -1) {
		const query = {
			text: `
				SELECT
					winner,
					loser,
					array_agg(isdraw)
				FROM public."QUERY_${year_Int}_admission${postfix}"
				GROUP BY
					winner,
					loser
				ORDER BY
					COUNT(isdraw) DESC
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
	//- This only outputs arrays of "[winner<STRING>, loser<STRING>, isDraw<BOOL[]>]"
	/* static async getAllMatches_School(year_Int = -1) {
		const query = {
			text: `
				SELECT *
				FROM public."QUERY_${year_Int}_competition_school${postfix}"
			`,
			rowMode: "array",
		};

		try {
			let res = await dbClient.query(query);
			return res.rows;
		} catch (err) {
			console.error(err.message);
		}
	} */
}
