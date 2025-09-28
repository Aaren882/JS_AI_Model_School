import dbClient from "../dataBase_Client.js";
import { Ts_data } from "../ts_validation.js";

//- Prefix "Data_" => 甄選
async function createDataView(year) {
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
      r_score AS r_score,
      COALESCE(
        "Distr_${year}".錄取總分數 /
        (
          "Distr_${year}".國文 +
          "Distr_${year}".英文 +
          "Distr_${year}".數學 +
          "Distr_${year}".專業一 +
          "Distr_${year}".專業二
        )
      , 0) AS "avg"
    FROM Public."Distr_${year}"
    RIGHT JOIN Public."Data_${year}" ON 
      "Data_${year}".學校 LIKE 
      FORMAT(
        '%s%s(%s)',
        "Distr_${year}".學校名稱,
        "Distr_${year}".系科組學程名稱,
        "Distr_${year}".招生群別
      )
    WHERE "Data_${year}".學校 IS NOT NULL
    `,
	};
	const create = {
		name: `create-QUERY_${year}_VIEW_Table`,
		text: `
      CREATE OR REPLACE View "QUERY_${year}" AS
        ${query.text}
    `,
	};

	const [query_data, ts_data] = await Promise.all([
		dbClient.query(query),
		Ts_data(year),
	]);

	//- #NOTE : Update R-score to DB
	let result = query_data.rows
		.map((x) => {
			const { deptcode } = x;
			return `(${deptcode}, ${ts_data.R_score(deptcode)})`;
		})
		.flat()
		.join(",");

	const insert = {
		name: `insert-${year}_VIEW_Table`,
		text: `
      UPDATE public."Data_${year}"
        SET 
          r_score = new_data.score
        FROM (VALUES
          ${result}
        )
        AS new_data(school_id, score)
        WHERE "校系代碼" = new_data.school_id;
    `,
	};
	await dbClient.query(insert);

	//- create view table
	await dbClient.query(create);

	console.log(
		`  ✅\x1b[32m-- Successfully create \"Query_${year}\" view.👁️\x1b[0m`
	);
}

//- Prefix "Data_Distr_" => 登記分發 #NOTE : Pending
async function createDistrView(year) {
	const query = {
		text: `
      SELECT
        FORMAT(
          '%s%s(%s)',
          學校名稱,
          系科組學程名稱,
          招生群別
        ) AS "fullName",
        (
          國文 +
          英文 +
          數學 +
          專業一 +
          專業二
        ) AS "coef",
        (
          錄取總分數 /
          (
            國文 +
            英文 +
            數學 +
            專業一 +
            專業二
          )
        ) AS "avg"
      FROM public."Distr_${year}"
    `,
	};
	const create = {
		name: `create-Distr_${year}_VIEW_Table`,
		text: `
      CREATE OR REPLACE View "QUERY_Distr_${year}" AS
        ${query.text}
    `,
	};

	//- create view table
	await dbClient.query(create);
	console.log(
		`  ✅\x1b[32m-- Successfully create \"QUERY_Distr_${year}\" view.👁️\x1b[0m`
	);
}

export function QueryViews(year) {
	return createDataView(year);
}
