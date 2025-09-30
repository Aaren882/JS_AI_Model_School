import { Pool } from "pg";
import SchoolQueue from "../objects/schoolQueue.js";
import { QueryViews } from "./DB/createDBViews.js";

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

function getPrompt(year = "0", post = "") {
	return `
    SELECT 
      "校系代碼" as id,
      "學校" as name,
      "正備取有效性" as posvalid
    FROM public."Data_${year}"
    where "正備取有效性" != 0 ${post}
  `;
}

export default dbClient;
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
}

export class dataBase_methods {
	static async initDatabase(year = 111) {
		const query = {
			text: `
        SELECT 
          cast (COUNT (*) AS Integer)
        FROM information_schema.views
        WHERE table_name LIKE 'QUERY_%'
      `,
			rowMode: "array",
		};

		console.log(`📄 \x1b[33m- Checking ${year} Tables.\x1b[0m`);

		//- Check table exist
		const total_Should_Exist = 1;

		try {
			let res = await dbClient.query(query);

			if (total_Should_Exist != res.rows[0]) {
				await Promise.all([QueryViews(year)]);
			}
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
      FROM public."QUERY_${year_Int}"
    `;

		try {
			let res = await dbClient.query(query);
			return res.rows;
		} catch (err) {
			console.error(err.message);
		}
	}
	//- 登記分發資料
	static async getAllSchool_Distr(year_Int = -1) {
		const query = `
      SELECT *
      FROM public."QUERY_Distr_${year_Int}"
    `;

		try {
			let res = await dbClient.query(query);
			return res.rows;
		} catch (err) {
			console.error(err.message);
		}
	}
}
