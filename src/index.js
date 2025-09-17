import 'dotenv/config'
import Express from 'express'
import showdown from 'showdown'
import path from 'path'

import API_router from './functions/API_Routes.js'
import { QueryChat } from './functions/ollamaQuery.js'
import { SchoolDB_Client } from './functions/dataBase_Client.js'

const __dirname = process.cwd() + '/src/views';

const showdownCt = new showdown.Converter(); //- MD convertor
const app = Express();

app.use('/api',API_router);
// app.use(Express.static(path.join(__dirname, 'public')));

//- set views
app.set('view engine', process.env.VIEW_ENGINE);
app.set('views', __dirname);

app.get('/', async (req,res) => {
  const dbClient = new SchoolDB_Client();

  const Queue = await dbClient.getDBSchool();
  const stringData = Queue.JSON_display();
  
  let chat_Res = await QueryChat(stringData);
  res.render('index', {
    chat: showdownCt.makeHtml(chat_Res.message.content)
  });
});

//- Env port
const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
  console.log(`\x1b[46m Server started !!\x1b[0m`);
  console.log(
    ` - on\x1b[33m http://localhost:${port}\x1b[0m`);
});
