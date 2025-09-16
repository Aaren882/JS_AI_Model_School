import { Client } from 'pg';
import SchoolQueue from '../objects/schoolQueue.js'

export default class SchoolDB_Client {
  dbClient = null;
  SchoolQueue = new SchoolQueue();

  async createClient() {
    const client = new Client({
      host : 'localhost',
      user: 'postgres',
      password: process.env.DB_PW,
      database: 'School_Test',
      port: 5432,
    });
    this.dbClient = client;
    client.connect()
      .then(() => console.log("CONNECTED"));
  }

  //- Get DB school
  async getDBSchool() {
    const query = `
      SELECT 
        "校系代碼" as id,
        "學校" as name,
        "正備取有效性" as posvalid
      FROM public."Data_111"
      where "正備取有效性" != 0
      LIMIT 50
    `;
    let _client = this.dbClient;
    let _res = await _client.query(query);

    //- Add to school
    _res.rows.forEach(obj => {
      if (obj) {
        this.SchoolQueue.AddSchool(obj);
      };
    });

    return this.SchoolQueue;
  }
}