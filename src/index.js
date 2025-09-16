import Express from 'express'
import 'dotenv/config'
import { QueryChat } from './functions/ollamaQuery.js'
import SchoolDB_Client from './functions/dataBase_Client.js'

const app = Express();

//- set views
app.set('view engine', process.env.VIEW_ENGINE);
app.set('views', process.cwd() + '/src/views');

app.get('/', async (req,res) => {
  const dbClient = new SchoolDB_Client();
  await dbClient.createClient();

  const Queue = await dbClient.getDBSchool();
  const stringData = Queue.JSON_display();
  
  let chat_Res = await QueryChat(stringData);
  res.render('index', {chat: chat_Res.message.content});
  // res.send(chat_Res.message.content);

  /* for await (const part of chat_Res) {
    // process.stdout.write(part.message.content);
    res.send(part.message.content);
  }; */
  
  // res.sendStatus(500);
  // res.json(Queue);
});

//- Env port
const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
  console.log(`\x1b[46m Server started !!\x1b[0m`);
  console.log(
    ` - on\x1b[33m http://localhost:${port}\x1b[0m`);
});
