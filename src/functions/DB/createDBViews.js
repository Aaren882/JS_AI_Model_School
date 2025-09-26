import dbClient from '../dataBase_Client.js'
import { Ts_data } from '../ts_validation.js'

export function QueryView(year) {
  return new Promise(async (resolve, reject) => {
    const query = {
      text: `
        SELECT 
          (
            SUBSTRING(
              cast ("校系代碼" as varChar),1,3
            )
          ) AS schoolCode,
          trim (
            SUBSTRING(
              "學校",
              1,
              POSITION('大學' IN "學校") + 1
            )
          ) AS schoolName,
          (
            cast ("校系代碼" AS varChar)
          ) AS deptCode,
          trim (
            SUBSTRING(
              "學校",
              POSITION('大學' IN "學校") + 2,
              POSITION('(' IN "學校") - POSITION('大學' IN "學校") - 2
            )
          ) AS deptName,
          trim (
            SUBSTRING(
              "學校",
              POSITION('(' IN "學校") + 1,
              POSITION(')' IN "學校") - POSITION('(' IN "學校") - 1
            )
          ) AS category,
          "正取有效性" AS posValid,
          "正備取有效性" AS admissionValidity,
          (
          CASE
            WHEN "一般生招生名額" = 0 THEN 
              -1.000
            ELSE
              (
                (
                  cast ("一般生招生名額" AS DOUBLE PRECISION) -
                  cast ("一般生名額空缺" AS DOUBLE PRECISION)
                ) /
                cast ("一般生招生名額" AS DOUBLE PRECISION)
              )
          END
        ) AS FirstStagePassRate,
          r_score AS r_score
        FROM public."Data_${year}"
      `
    };
    const create = {
      name : `create-${year}_VIEW_Table`,
      text : `
        Create View "QUERY_${year}" AS
          ${query.text}
      `,
    };

    try { //- create view table

      const [query_data, ts_data] = await Promise.all([
        dbClient.query(query),
        Ts_data(year)
      ]);

      //- #NOTE : Update R-score to DB
      let result = query_data.rows.map(x => {
        const { deptcode } = x;
        return `(${deptcode}, ${ts_data.R_score(deptcode)})`;
      }).flat().join(',');

      const insert = {
        name : `insert-${year}_VIEW_Table`,
        text : `
          UPDATE public."Data_${year}"
            SET 
              r_score = new_data.score
            FROM (VALUES
              ${result}
            )
            AS new_data(school_id, score)
            WHERE "校系代碼" = new_data.school_id;
        `
      };
      await dbClient.query(insert);
      
      //- create view table
      await dbClient.query(create);
      
      console.log(`  ✅\x1b[32m-- Successfully create \"${year}_Query\" view.👁️\x1b[0m`);
      resolve();
    } catch (error) {
      console.error(error);
      reject(error.error);
    }
  });
  
}