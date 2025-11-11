import dbClient from "../DB/dataBase_Client.js";
import { Ts_data, Ts_matching_Ratings_Array } from "../ts_validation.js";
const postfix = process.env.QUERY_POSTFIX || "";

//- Prefix "Data_" => 甄選
async function createDataView(year, query_TableName) {
  /* 
    AdmissionVacancies (一般生名額空缺)
      : max("一般生名額空缺", 0)
      
    AdmissionNumber (一般生錄取名額)
      : "一般生招生名額" - max("一般生名額空缺", 0)
      
    TotalAdmissionNumber (一般生招生名額)
      : "一般生招生名額"
  */
  const query = {
		text: `
      SELECT 
        schoolCode,
        schoolName,
        deptCode,
        deptName,
        category,
        MIN(posValid) AS posValid,
        MIN(admissionValidity) AS admissionValidity,

        MIN(
          AdmissionNumber
        ) AS AdmissionNumber,
        MIN(
          AdmissionVacancies
        ) AS AdmissionVacancies,
        MIN(
          TotalAdmissionNumber
        ) AS TotalAdmissionNumber,

        MIN(
          CASE
          WHEN TotalAdmissionNumber = 0 THEN
            0
          ELSE
            AdmissionNumber / TotalAdmissionNumber
          END
        ) AS AdmissionRate,

        MIN(r_score) AS r_score,

        MIN(
          CASE
          WHEN TotalAdmissionNumber = 0 THEN
            0
          ELSE
            AdmissionVacancies / TotalAdmissionNumber
          END
        ) AS ShiftRatio,
        
        MIN("avg") AS "avg"
      FROM 
        public."QUERY_${year}_init${postfix}"
    GROUP BY 
      schoolCode,
      schoolName,
      deptCode,
      deptName,
      category
    `,
	};
  
	const create = {
    name: `create-${query_TableName}_VIEW_Table`,
		text: `
      CREATE MATERIALIZED VIEW "${query_TableName}" AS
        ${query.text}
    `,
	};

  //- create view table
  await dbClient.query(create);

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
}

//- Prefix "QUERY_Init_" => 輕量整理後的初始資料
async function createInitView(year, query_TableName) {

  const query = {
    text: `
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
              cast ("一般生招生名額" AS DOUBLE PRECISION) -
              LEAST(
                cast ("一般生招生名額" AS DOUBLE PRECISION),
                GREATEST(
                  cast ("一般生名額空缺" AS DOUBLE PRECISION),
                  0
                )
              )
            )
          END
        ) AS AdmissionNumber,
        cast ("一般生招生名額" AS DOUBLE PRECISION) AS TotalAdmissionNumber,
        cast ("一般生正取錄取人數" AS DOUBLE PRECISION) AS AcceptanceNumber,
        cast ("正取總人數" AS DOUBLE PRECISION) AS acceptanceTotalCount,
        GREATEST(
          cast ("一般生名額空缺" AS DOUBLE PRECISION),0
        ) AS AdmissionVacancies,
         
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
    `,
  };
  const create = {
    name: `create-${query_TableName}_VIEW_Table`,
    text: `
      CREATE MATERIALIZED VIEW "${query_TableName}" AS
        ${query.text}
    `,
  };

  //- create view table
  await dbClient.query(create);
}

//- Prefix "QUERY_Admission_" => 甄選選擇
async function createAdmissionView(year, query_TableName) {
  const competitions = ['二','三','四','五','六'];
  
  let drawTable = "";
  competitions.forEach((x, index) => {
    let draws = competitions.slice(index + 1);
    if (draws.length != 0) {
      const drawExpress = `
        UNION (
          SELECT 
            CAST (WINNER AS text),
            CAST (LOSER AS text),
            true AS isDraw
          FROM
          (
            SELECT 
              ${x} AS WINNER,
              unnest(array[
                ${draws}
              ]) AS LOSER
            FROM public.admission_${year}
          )
        )`;
      drawTable += drawExpress;
    }
  });

  const query = {
    text: `
      SELECT * FROM
      (
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
            FROM public.admission_${year}
          )
        ) ${drawTable}
      )
      WHERE 
        LOSER IS NOT NULL
    `,
  };
  const create = {
    name: `create-${query_TableName}_VIEW_Table`,
    text: `
      CREATE MATERIALIZED VIEW "${query_TableName}" AS
        ${query.text}
    `,
  };

  //- create view table
  await dbClient.query(create);
}
async function createCompetitionViews_School(year, query_TableName) {
  const query = {
    text: `
      SELECT
        winner,
        loser,
        array_agg(isdraw) AS results,
        COUNT(*)
      FROM (
        SELECT
          SUBSTRING(winner,1,3) AS winner,
          SUBSTRING(loser,1,3) AS loser,
          isdraw
        FROM public."QUERY_${year}_admission${postfix}"
      )
      WHERE
        (winner != loser)
      GROUP BY
        winner,
        loser
    `,
    rowMode: "array",
  };
  const query_data = await dbClient.query(query);
  const TS = await Ts_matching_Ratings_Array(year, query_data.rows);
  const R_scores = TS.nodes.map(([schoolCode, score]) => `(${schoolCode}, ${score})`)
    .join(",");

  const create = {
    name: `create-${query_TableName}_VIEW_Table`,
    text: `
      CREATE MATERIALIZED VIEW "${query_TableName}" AS
        SELECT 
          cast ("schoolcode" AS text),
          cast ("r_score" AS text)
        FROM (VALUES
          ${R_scores}
        ) AS new_data(schoolcode, r_score)
    `,
  };

  //- create view table
  await dbClient.query(create);
}
async function createCompetitionViews_Group(year, query_TableName) {
  const query = {
    text: `
      SELECT
        FORMAT('%s-%s', SC.schoolcode, SC.deptname) AS winner,
        FORMAT('%s-%s', SC2.schoolcode, SC2.deptname) AS loser,
        TG.results,
        TG.relationCount
      FROM (
      (
        SELECT
          winner,
          loser,
          array_agg(isdraw) AS results,
          COUNT (*) AS relationCount
        FROM (
          SELECT *
          FROM public."QUERY_${year}_admission${postfix}"
        )
        WHERE
          (winner != loser)
        GROUP BY
          winner,
          loser
      ) TG
      JOIN
        (
          SELECT
            schoolcode,
            deptname,
            array_agg(deptcode) AS deptcodes
          FROM
            public."QUERY_${year}${postfix}"
          GROUP BY
            schoolcode,
            deptname
        ) SC
        ON
          TG.winner = ANY(SC.deptcodes)
      JOIN
        (
          SELECT
            schoolcode,
            deptname,
            array_agg(deptcode) AS deptcodes
          FROM
            public."QUERY_${year}${postfix}"
          GROUP BY
            schoolcode,
            deptname
        ) SC2
        ON
          TG.loser = ANY(SC2.deptcodes)
      );
    `,
    rowMode: "array",
  };

  const query_data = await dbClient.query(query);
  const TS = await Ts_matching_Ratings_Array(year, query_data.rows);
  const R_scores = TS.nodes.map(([schoolCode, score]) => `(\'${schoolCode}\', ${score})`)
    .join(",");

  const create = {
    name: `create-${query_TableName}_VIEW_Table`,
    text: `
      CREATE MATERIALIZED VIEW "${query_TableName}" AS
        SELECT
          cast ("schoolcode" AS text),
          cast ("r_score" AS text)
        FROM (VALUES
          ${R_scores}
        ) AS new_data(schoolcode, r_score)
    `,
  };

  //- create view table
  await dbClient.query(create);
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

export function QueryInitViews(year, query_TableName) {
  return createInitView(year, query_TableName);
}
export function QueryViews(year, query_TableName) {
  return createDataView(year, query_TableName);
}

export function QueryAdmissionViews(year, query_TableName) {
  return createAdmissionView(year, query_TableName);
}
export function QueryCompetitionViews_School(year, query_TableName) {
  return createCompetitionViews_School(year, query_TableName);
}
export function QueryCompetitionViews_Group(year, query_TableName) {
  return createCompetitionViews_Group(year, query_TableName);
}