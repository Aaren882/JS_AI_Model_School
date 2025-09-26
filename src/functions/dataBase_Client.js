import { Pool } from 'pg';
import SchoolQueue from '../objects/schoolQueue.js'
import { QueryView } from './DB/createDBViews.js'

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
    host : 'localhost',
    user: 'postgres',
    password: process.env.DB_PW,
    database: 'School_Test',
    port: 5432,
  });

  try {
    dbClient = await pool.connect()
    console.log("\x1b[42mDatabase Connected.\x1b[0m");
  } catch (errors) { //- The error is "AggregateError"
    console.log(`\x1b[41mCannot connect to Database !!\x1b[0m`);
    e.errors.forEach(x =>{
      console.error(`Database Error - \"\x1b[31m${x.message}\x1b[0m\"`);
    });
  }
}

function getPrompt(year = '0', post = '') {
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
  getAnalyzeSchools(year = '') {
    const query = getPrompt(year, 'LIMIT 50');

    return new Promise((resolve, reject) => {
      dbClient.query(query)
        .then(_res => {
          //- Add to school
          _res.rows.forEach(obj => {
            if (obj) {
              this.SchoolQueue.AddSchool(obj);
            };
            resolve(this.SchoolQueue);
          });
        })
        .catch(err => {
          console.error(err.message);
          reject(err.message)
        });
    })
    
  }
}

export class dataBase_methods {

  static async initDatabase(year = 111) {
    const query = `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.views
        WHERE table_name = 'QUERY_111'
      ) AS existence;
    `;

    console.log(`📄\x1b[33m- Checking ${year} Tables.\x1b[0m`);
    //- Check table exist
    try {
      let res = await dbClient.query(query);
      if (!res.rows[0]['existence']) {
        Promise.all([
          QueryView(year)
        ]).then();
      }
    } catch (err) {
      console.error(err);
    }
  }
  
  /* 
    Query from view tables for better speed
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
}