import Express from 'express'
import showdown from 'showdown'
import { QueryChat } from './ollamaQuery.js';
import dbClient from './dataBase_Client.js'

const showdownCt = new showdown.Converter(); //- MD convertor
const API_router = Express.Router();

/*
  year = the target year
*/
API_router.get('/getAllSchool', (req, res) => {
  let { year = "0" } = req.query;
  let year_Int = parseInt(year);

  if (year_Int === 0) {
    res.status(404).send("404 Error no data.");
    return;
  }

  const query = `
    SELECT *
    FROM public."${year_Int}_QUERY"
  `;

  dbClient.query(query)
    .then(_res => {

      const data = {};
      
      _res.rows.forEach(elem => {
        const { //- #NOTE - all the query name will be lowercase
          schoolcode,
          schoolname,
          deptcode,
          deptname,
          category
        } = elem;

        let curData = data[schoolcode];
        if (!curData) {
          data[schoolcode] = {
            name: schoolname,
            departments: {},
          };
          curData = data[schoolcode];
        }

        let curDepartment = curData.departments[deptcode];
        if (!curDepartment) {
          curData.departments[deptcode] = {
            name: deptname,
            categories: [],
          };
          curDepartment = curData.departments[deptcode];
        }

        curDepartment.categories.push(category);
      });

      //- Responses
      res.status(200).json(data);
    })
    .catch(err => {
      res.status(404).send("404 Error no data.");
      console.error(err.message);
    });
});

/*
  year = the target year
*/
API_router.get('/getSchoolAnalyze', async (req, res) => {
  let {
    year = '0',
    schoolID = ''
  } = req.query;

  if (year === "0" || schoolID === '') {
    res.status(404).send("404 Error no data.");
    return;
  }
  let int_Year = parseInt(year);
  let int_ID = parseInt(schoolID);
  
  const query = `SELECT 
    "校系代碼" as id,
    "學校" as name,
    "正備取有效性" as posvalid
  FROM public."Data_${int_Year}"
  where 
    ("正備取有效性" != 0) AND
    ("校系代碼" = ${int_ID})`;

  try {
    //- Asking AI
    let q = await dbClient.query(query);
    
    //- Construct data format
    const data = {};
    q.rows.forEach(elem =>{
      let { id, name, posvalid } = elem;
      data[id] = {
        name: name,
        posvalid : posvalid
      };
    });
    let chat_Res = await QueryChat(`${data}`, "這間學校很受歡迎嗎?");

    chat_Res = showdownCt.makeHtml(chat_Res.message.content);
    res.status(200).json({chat: chat_Res});

  } catch (err) {
    res.status(404).send("404 Error no data.");
    console.error(err.message);
  }
});

/*
  id = school id
*/
API_router.get('/getSchoolDeparts', (req, res) => {
  let { id } = req.query;
  let id_Int = parseInt(id);
  console.log(id);
  res.status(200);
  res.send(id_Int);
});

export default API_router;