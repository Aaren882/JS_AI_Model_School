import dbClient from './dataBase_Client.js'
import { rate_1vs1, Rating } from 'ts-trueskill';

const query = `
  SELECT 
    校系代碼 AS id
  FROM public."Data_111"
`;

function R_score(input) {
  let mu = input.mu;
  let sigma = input.sigma;
  return mu-2*sigma;
}

export async function validate() {
  try {
    let result = await dbClient.query(query);

    //- NODES
    const nodes = new Map();
    result.rows.forEach(team => { //- split schools into teams
      if (team['id'] !== null)
        nodes.set(team['id'].toString(), new Rating());
    });
    
    //- Rate all the matches
    const edges = [];
    result = await dbClient.query(`
      SELECT 
        ARRAY[
          一,
          二,
          三,
          四,
          五,
          六
        ] AS competitives
      FROM public.admission_111
    `);
    
    result.rows.forEach(match => {
      let obj = match['competitives'];
      let winner = obj[0];

      for (let index = 1; index < obj.length; index++) {
        const element = obj[index];
        
        if (null === element)
          continue;
        
        let edge = [winner.toString(), element.toString()];
        let isDraw = (winner === element);

        //- Update rating value
        let [Source_rank, Target_rank] = edge.map(e => {
          return nodes.get(e);
        });

        let [newP1, newP2] = rate_1vs1(
          Source_rank,
          Target_rank,
          isDraw
        );
        
        edges.push(edge);
        nodes.set(edge[0], newP1);
        nodes.set(edge[1], newP2);
      }
    });
    console.log(`102029 : ${R_score(nodes.get('102029'))}`);
    console.log(`105068 : ${R_score(nodes.get('105068'))}`);
  } catch (error) {
    console.error(error.message);
  }
}
