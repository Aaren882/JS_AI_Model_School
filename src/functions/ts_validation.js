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
      const objs = match['competitives'];

      for (let i = 0; i < objs.length; i++) {
        
        const isDraw = i > 0;
        const last_elem = objs[i];

        for (let j = i + 1; j < objs.length; j++) {
          const element = objs[j];
          
          //- Skip if element is null
          if (null === element)
            continue;
          
          const cur_edge = [last_elem.toString(), element.toString()];

          //- Update rating value
          const [Source_rank, Target_rank] = cur_edge.map(e => {
            return nodes.get(e);
          });
          
          //- Rating
          const [newP1, newP2] = rate_1vs1(
            Source_rank,
            Target_rank,
            isDraw
          );
          
          edges.push(cur_edge);
          nodes.set(cur_edge[0], newP1);
          nodes.set(cur_edge[1], newP2);
        }
      }
      
    });
    console.log(`102029 : ${R_score(nodes.get('102029'))}`);
    console.log(`105068 : ${R_score(nodes.get('105068'))}`);
  } catch (error) {
    console.error(error.message);
  }
}
