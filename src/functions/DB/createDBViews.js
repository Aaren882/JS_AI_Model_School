import dbClient from "../DB/dataBase_Client.js";
import { postfix } from "../DB/dataBase_Client.js";
import { Ts_data, Ts_matching_Ratings_Array } from "../ts_validation.js";

//- Prefix "Data_" => 甄選
async function createDataView(year, query_TableName) {
  /* 
    AdmissionVacancies (一般生名額空缺)
      : max("一般生名額空缺", 0)
      
    AdmissionNumber (一般生錄取名額)
      : "一般生招生名額" - max("一般生名額空缺", 0)
    
    //- 統測甄選
    TotalAdmissionNumber (一般生招生名額)
      : 
    TotalRegistered (報到人數)
      :
    AcceptanceNumber (一般生正取錄取人數)
      : 
    WaitListNumber (一般生備取錄取人數)
      :
    TotalAcceptanceNumber (一般生正取總人數)
      :
    TotalWaitListNumber (備取總人數)
      :
    
    //- 統測分發 (Tutc 統測)
    Tutc_TotalAdmissionNumber (招生名額)
      : NULL 會變成 0
    Tutc_TotalAcceptanceNumber (錄取人數)
      : NULL 會變成 0
  */
  const query = {
		text: `
      SELECT
        *,
        CASE
          WHEN TotalAdmissionNumber = 0 THEN
            0
          ELSE
            AdmissionNumber / TotalAdmissionNumber
          END AS AdmissionRate,

        CASE
          WHEN TotalAdmissionNumber = 0 THEN
            0
          ELSE
            AdmissionVacancies / TotalAdmissionNumber
          END AS ShiftRatio
      FROM
        public."QUERY_${year}_init${postfix}"
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
    .flatMap((x) => {
			const { deptcode } = x;
			return `(${deptcode}, ${ts_data.R_score(deptcode)})`;
		})
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

async function createDataView_School(year, query_TableName) {
  const query = {
    text: `
      SELECT
        SC.*,
        CAST(TG.r_score AS real)
      FROM
      (
        SELECT
          schoolCode,
          schoolName,

          SUM(AdmissionVacancies) AS AdmissionVacancies,
          SUM(AdmissionNumber) AS AdmissionNumber,
          SUM(TotalAdmissionNumber) AS TotalAdmissionNumber,

          SUM(TotalRegistered) AS TotalRegistered,
          SUM(AcceptanceNumber) AS AcceptanceNumber,
          SUM(WaitListNumber) AS WaitListNumber,
          SUM(TotalAcceptanceNumber) AS TotalAcceptanceNumber,
          SUM(TotalWaitListNumber) AS TotalWaitListNumber,
          
          SUM(Tutc_TotalAdmissionNumber) AS Tutc_TotalAdmissionNumber,
          SUM(Tutc_TotalAcceptanceNumber) AS Tutc_TotalAcceptanceNumber,

          CASE
            WHEN SUM(TotalAcceptanceNumber) = 0 THEN
            0
            ELSE
            SUM(AcceptanceNumber) / SUM(TotalAcceptanceNumber)
            END AS posValid,

          CASE
            WHEN SUM(TotalAdmissionNumber) = 0 THEN
            0
            ELSE
            SUM(AdmissionNumber) / SUM(TotalAdmissionNumber)
            END AS AdmissionRate,


          CASE
            WHEN SUM(TotalAdmissionNumber) = 0 THEN
            0
            ELSE
            SUM(AdmissionVacancies) / SUM(TotalAdmissionNumber)
            END AS ShiftRatio,
          
          MIN("avg") AS "avg"
        FROM public."QUERY_${year}_init${postfix}"
        GROUP BY
          schoolCode,
          schoolName
      ) SC
      INNER JOIN
        public."QUERY_${year}_R_table_school${postfix}" TG
      ON SC.schoolcode = TG.schoolcode
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

async function createDataView_Department(year, query_TableName) {
  const query = {
    text: `
      SELECT
        SC.*,
        cast(TG.r_score AS real)
      FROM
      (
        (
          SELECT
            schoolCode,
            schoolName,
            deptname,
            array_agg(DISTINCT deptcode) AS deptcodes,
            array_agg(DISTINCT category) AS categories,

            SUM(AdmissionVacancies) AS AdmissionVacancies,
            SUM(AdmissionNumber) AS AdmissionNumber,
            SUM(TotalAdmissionNumber) AS TotalAdmissionNumber,

            SUM(TotalRegistered) AS TotalRegistered,
            SUM(AcceptanceNumber) AS AcceptanceNumber,
            SUM(WaitListNumber) AS WaitListNumber,
            SUM(TotalAcceptanceNumber) AS TotalAcceptanceNumber,
            SUM(TotalWaitListNumber) AS TotalWaitListNumber,

            SUM(Tutc_TotalAdmissionNumber) AS Tutc_TotalAdmissionNumber,
            SUM(Tutc_TotalAcceptanceNumber) AS Tutc_TotalAcceptanceNumber,

            CASE
              WHEN SUM(TotalAcceptanceNumber) = 0 THEN
              0
              ELSE
              SUM(AcceptanceNumber) / SUM(TotalAcceptanceNumber)
              END AS posValid,

            CASE
              WHEN SUM(TotalAdmissionNumber) = 0 THEN
              0
              ELSE
              SUM(AdmissionNumber) / SUM(TotalAdmissionNumber)
              END AS AdmissionRate,

              CASE
              WHEN SUM(TotalAdmissionNumber) = 0 THEN
              0
              ELSE
              SUM(AdmissionVacancies) / SUM(TotalAdmissionNumber)
              END AS ShiftRatio,

            MIN("avg") AS "avg"
          FROM public."QUERY_${year}_init${postfix}"
          GROUP BY
            schoolCode,
            schoolName,
            deptname
        ) SC
        INNER JOIN
          public."QUERY_${year}_R_table_department${postfix}" TG
        ON 
          SC.schoolcode = TG.schoolcode AND
          SC.deptname = TG.deptname
      )
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

//- Prefix "QUERY_Init_" => 輕量整理後的初始資料
async function createInitView(year, query_TableName) {
  //- Updates the min_AVG_Query
  const Create_min_AVG_Query = {
    name: `Create_min_AVG_Query-${year}_VIEW_Table`,
    text: `
      DO $$
        BEGIN
        IF EXISTS (
          SELECT 1 
          FROM information_schema.tables
          WHERE 
            table_schema = 'public' AND
            table_name = 'min_AVG_Query_${year}'
        ) THEN
          RAISE NOTICE 'Table "min_AVG_Query_${year}" does exist. Cannot create table.';
        ELSE
          CREATE TABLE IF NOT EXISTS public."min_AVG_Query_${year}" (
            schoolname character varying,
            deptname character varying,
            categories text[],
            min_avg real
          );

          INSERT INTO public."min_AVG_Query_${year}"
            (schoolname, deptname, categories, min_avg)
            SELECT
              "學校名稱" AS schoolname,
              "系科組學程名稱" AS deptname,
              ARRAY_Agg("群別代號") AS categories,
              MIN(
                COALESCE(
                  "錄取總分數" /
                  (
                    "國文" +
                    "英文" +
                    "數學" +
                    "專業一" +
                    "專業二"
                  ),
                  999
                )
              ) AS "min_avg"
            FROM public."Distr_${year}"
            WHERE
              "系科組學程名稱" IS NOT NULL
            GROUP BY
              "學校名稱",
              "系科組學程名稱";
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE
            table_schema = 'public' AND
            table_name = 'Group_Classes'
        ) THEN
          RAISE NOTICE 'Table "Group_Classes" does exist. Cannot create table.';
        ELSE
          CREATE TABLE public."Group_Classes" (
            group_classes text[]
          );

          INSERT INTO public."Group_Classes"
            (group_classes) VALUES
            (ARRAY['21','09']);
        END IF;
      END $$;
    `,
  };

  //- insert "min_AVG_Query"
  await dbClient.query(Create_min_AVG_Query);

  //- #NOTE : 這個過濾方法能解決 99%，可能還是會miss掉一些
  const query = {
    text: `
    SELECT DISTINCT
      (
        LEFT(
          cast ("校系代碼" as varChar),3
        )
      ) AS schoolCode,
      SC.學校名稱 AS schoolName,
      (
        cast ("校系代碼" AS varChar)
      ) AS deptCode,
      SC.系科組學程名稱 AS deptName,
      SC.群別代號 AS category,

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

      COALESCE(
        "Distr_${year}".招生名額,
        0
      ) AS Tutc_TotalAdmissionNumber,
      COALESCE(
        "Distr_${year}".錄取人數,
        0
      ) AS Tutc_TotalAcceptanceNumber,

      cast ("一般生招生名額" AS DOUBLE PRECISION) AS TotalAdmissionNumber,

      cast ("正取總人數" AS DOUBLE PRECISION) AS TotalAcceptanceNumber,
      cast ("備取總人數" AS DOUBLE PRECISION) AS TotalWaitListNumber,

      cast ("一般生正取錄取人數" AS DOUBLE PRECISION) AS AcceptanceNumber,
      cast ("一般生備取錄取人數" AS DOUBLE PRECISION) AS WaitListNumber,
      cast ("報到人數" AS DOUBLE PRECISION) AS TotalRegistered,
      GREATEST(
        cast ("一般生名額空缺" AS DOUBLE PRECISION),0
      ) AS AdmissionVacancies,

      r_score AS r_score,

      COALESCE(
        "Distr_${year}".錄取總分數 /
        (
          "Distr_${year}".國文 +
          "Distr_${year}".英文 +
          "Distr_${year}".數學 +
          "Distr_${year}".專業一 +
          "Distr_${year}".專業二
        ),
        alter_avg,
        min_avg,
        999
      ) AS "avg"
    FROM Public."Distr_${year}"

    RIGHT JOIN
      Public."Data_${year}" SC
    ON
      SC.群別代號 = "Distr_${year}".群別代號 AND
      SC.學校名稱 = "Distr_${year}".學校名稱 AND
      "Distr_${year}".群別代號 = "Distr_${year}".群別代號 AND
      (
        POSITION(SC.系科組學程名稱 IN "Distr_${year}".系科組學程名稱) > 0 OR
        POSITION("Distr_${year}".系科組學程名稱 IN SC.系科組學程名稱) > 0
      )
    
    LEFT JOIN
      (
        SELECT
          INNER_SC.schoolname,
          INNER_SC.deptname,
          INNER_SC."min_avg" AS "alter_avg",
          INNER_SC2."min_avg" AS "min_avg"
        FROM (
        (
          SELECT
            "學校名稱" AS schoolname,
            "系科組學程名稱" AS deptname,

            COALESCE(
              "錄取總分數" /
              (
                "國文" +
                "英文" +
                "數學" +
                "專業一" +
                "專業二"
              ),
              999
            ) AS "min_avg"
          FROM public."Distr_${year}"
          LEFT JOIN
            public."Group_Classes"
          ON
            "群別代號" = ANY(group_classes)
        ) INNER_SC

      JOIN
        public."min_AVG_Query_${year}" INNER_SC2
      ON
        INNER_SC.schoolname = INNER_SC2.schoolname AND
        INNER_SC.deptname = INNER_SC2.deptname
      )
    ) SC2
    ON
      SC."學校名稱" = SC2.schoolname AND
      (
        POSITION(SC.系科組學程名稱 IN SC2.deptname) > 0 OR
        POSITION(SC2.deptname IN SC.系科組學程名稱) > 0
      )
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
        COUNT(*) AS relationCount
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
async function createCompetitionViews_Department(year, query_TableName) {
  const query = {
    text: `
      SELECT
        FORMAT(
          '%s-%s',
          SC.schoolcode,
          SC.deptname
        ) AS winner,
        SC.schoolcode AS winner_schoolcode,
        SC.deptname AS winner_deptname,
        SC.deptcodes AS winner_deptcodes,

        FORMAT(
          '%s-%s',
          SC2.schoolcode,
          SC2.deptname
        ) AS loser,
        SC2.schoolcode AS loser_schoolcode,
        SC2.deptname AS loser_deptname,
        SC2.deptcodes AS loser_deptcodes,

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
      INNER JOIN
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
      INNER JOIN
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
      )
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
async function create_R_table_School(year, query_TableName) {
  const query = {
    text: `
      SELECT *
      FROM public."QUERY_${year}_competition_school${postfix}"
    `,
    rowMode: "array",
  };

  const { rows } = await dbClient.query(query);
  const TS = await Ts_matching_Ratings_Array(year, rows);
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
async function create_R_table_Department(year, query_TableName) {
  const query = {
    text: `
      SELECT
        FORMAT(
          '%s-%s-%s',
          winner_schoolcode,
          winner_deptname,
          ARRAY_TO_STRING(winner_deptcodes, ',')
        ) AS winner,
        FORMAT(
          '%s-%s-%s',
          loser_schoolcode,
          loser_deptname,
          ARRAY_TO_STRING(loser_deptcodes, ',')
        ) AS loser,
        results,
        relationCount
      FROM 
        public."QUERY_${year}_competition_department${postfix}"
    `,
    rowMode: "array",
  };

  const { rows } = await dbClient.query(query);
  const TS = await Ts_matching_Ratings_Array(year, rows);
  const R_scores = TS.nodes.map(([deptCode, score]) => {
    let [schoolCode, deptName, deptcodes] = deptCode.split('-');
    
    return `(\'${schoolCode}\', \'${deptName}\', ARRAY[\'${deptcodes.split(',').join("','")}\'], ${score})`;
  })
    .join(",");

    const create = {
    name: `create-${query_TableName}_VIEW_Table`,
    text: `
      CREATE MATERIALIZED VIEW "${query_TableName}" AS
        SELECT
          cast ("schoolcode" AS text),
          cast ("deptname" AS text),
          cast ("deptcodes" AS text[]),
          cast ("r_score" AS text)
        FROM (VALUES
          ${R_scores}
        ) AS new_data(schoolcode, deptname, deptcodes, r_score)
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
export function QueryAdmissionViews(year, query_TableName) {
  return createAdmissionView(year, query_TableName);
}

//- Summarized Data
export function QueryViews(year, query_TableName) {
  return createDataView(year, query_TableName);
}
export function QueryViews_School(year, query_TableName) {
  return createDataView_School(year, query_TableName);
}
export function QueryViews_Department(year, query_TableName) {
  return createDataView_Department(year, query_TableName);
}

//- Competition Data (winner, loser)
export function QueryCompetitionViews_School(year, query_TableName) {
  return createCompetitionViews_School(year, query_TableName);
}
export function QueryCompetitionViews_Department(year, query_TableName) {
  return createCompetitionViews_Department(year, query_TableName);
}

//- Competition Data (winner, loser)
export function Query_R_table_School(year, query_TableName) {
  return create_R_table_School(year, query_TableName);
}
export function Query_R_table_Department(year, query_TableName) {
  return create_R_table_Department(year, query_TableName);
}