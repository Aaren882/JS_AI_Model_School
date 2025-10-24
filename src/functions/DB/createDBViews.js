import dbClient from "../dataBase_Client.js";
import { Ts_data } from "../ts_validation.js";

//- Prefix "Data_" => 甄選
async function createDataView(year) {
  const query_TableName = `QUERY_${year}${process.env.QUERY_POSTFIX || ""}`;
  const query = {
		text: `
      SELECT 
        schoolCode,
        schoolName,
        deptCode,
        deptName,
        category,
        AVG(posValid) AS posValid,
        AVG(admissionValidity) AS admissionValidity,
        AVG(AdmissonRate) AS AdmissonRate,
        AVG(r_score) AS r_score,
        AVG(ShiftRatio) AS ShiftRatio,
        AVG("avg") AS "avg"
      FROM (
        SELECT 
        (
          SUBSTRING(
            cast ("校系代碼" as varChar),1,3
          )
        ) AS schoolCode,
        "Data_${year}".學校名稱 AS schoolName,
        (
          cast ("校系代碼" AS varChar)
        ) AS deptCode,
        "Data_${year}".系科組學程名稱 AS deptName,
        "Data_${year}".群別代號 AS category,
        "正取有效性" AS posValid,
        "正備取有效性" AS admissionValidity,
        (
          CASE
          WHEN "一般生招生名額" = 0 THEN 
            0
          ELSE
            (
              (
                cast ("一般生招生名額" AS DOUBLE PRECISION) -
                LEAST(
                  cast ("一般生招生名額" AS DOUBLE PRECISION),
                  GREATEST(
                    cast ("一般生名額空缺" AS DOUBLE PRECISION),
                    0
                  )
                )
              ) /
            cast ("一般生招生名額" AS DOUBLE PRECISION)
            )
          END
        ) AS AdmissonRate,
        r_score AS r_score,
        (
          CASE
          WHEN "一般生招生名額" = 0 THEN 
            0
          ELSE
            GREATEST(
              cast ("一般生名額空缺" AS DOUBLE PRECISION),
              0
            ) / 
            cast ("一般生招生名額" AS DOUBLE PRECISION)
          END
        ) AS ShiftRatio,
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
        "Data_${year}".學校名稱 LIKE "Distr_${year}".學校名稱 AND
        POSITION("Data_${year}".系科組學程名稱 IN "Distr_${year}".系科組學程名稱) > 0 AND
        "Distr_${year}".群別代號 LIKE "Distr_${year}".群別代號
    )
    GROUP BY 
      schoolCode,
      schoolName,
      deptCode,
      deptName,
      category
    `,
	};
  
	const create = {
		name: `create-QUERY_${year}_VIEW_Table`,
		text: `
      CREATE MATERIALIZED VIEW "${query_TableName}" AS
        ${query.text}
    `,
	};

	const [query_data, ts_data] = await Promise.all([
		dbClient.query(query),
		Ts_data(year),
	]);

	//- #NOTE : Update R-score to DB
	let R_scores = query_data.rows
		.map((x) => {
			const { deptcode } = x;
			return `(${deptcode}, ${ts_data.R_score(deptcode)})`;
		})
		.flat()
		.join(",");

	const insert_R = {
		name: `insert_R_Score-${year}_VIEW_Table`,
		text: `
      UPDATE public."Data_${year}"
        SET 
          r_score = new_data.score
        FROM (VALUES
          ${R_scores}
        )
        AS new_data(school_id, score)
        WHERE "校系代碼" = new_data.school_id;
    `,
	};
  const ShiftRatios = query_data.rows.map((x) => {
      const { deptcode, shiftratio } = x;
      return `(${deptcode}, ${shiftratio})`;
    })
    .join(",");

  const insert_ShiftRatios = {
		name: `insert_ShiftRatios-${year}_VIEW_Table`,
		text: `
      UPDATE public."Data_${year}"
        SET 
          甄選名額流去登分比例 = new_data.shiftratio
        FROM (VALUES
          ${ShiftRatios}
        )
        AS new_data(school_id, shiftratio)
        WHERE "校系代碼" = new_data.school_id;
    `,
	};
	await Promise.all(
		[insert_R, insert_ShiftRatios].map((x) => {
			dbClient.query(x)
		})
	);

	//- create view table
	await dbClient.query(create);

	console.log(
		`  ✅\x1b[32m-- Successfully create \"QUERY_${year}${process.env.QUERY_POSTFIX || ""}\" view.👁️\x1b[0m`
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
