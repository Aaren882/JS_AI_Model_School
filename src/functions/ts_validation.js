import dbClient from "./dataBase_Client.js";
import { rate_1vs1, Rating } from "ts-trueskill";

class Ts_Rating {
	constructor(nodes, edges) {
		this.nodes = nodes;
		this.edges = edges;
	}

	R_score(id) {
		let rating = this.nodes.get(id);
		let mu = rating.mu;
		let sigma = rating.sigma;
		return mu - 2 * sigma;
	}

	//- Get one level nodes around
	getLevelNodes(query_target = "") {
		let query_nodes = [];
		const cur_nodes = this.edges.filter((x) => x.includes(query_target));

		/* const query_level = 1;
    for (let index = 0; index < query_level; index++) {
    } */
		return query_nodes.concat(cur_nodes);
	}
}

export async function Ts_data(year = 111) {
	try {
		let query = `
      SELECT 
        校系代碼 AS id
      FROM public."Data_${year}"
    `;
		let _query = await dbClient.query(query);

		//- NODES
		const nodes = new Map();
		_query.rows.forEach((team) => {
			//- split schools into teams
			if (team["id"] !== null) nodes.set(team["id"].toString(), new Rating());
		});

		//- Rate all the matches (EDGES)
		query = `
      SELECT 
        ARRAY[
          一,
          二,
          三,
          四,
          五,
          六
        ] AS competitives
      FROM public.admission_${year}
    `;
		const edges = [];
		_query = await dbClient.query(query);

		_query.rows.forEach((match) => {
			const objs = match["competitives"];

			for (let i = 0; i < objs.length; i++) {
				const isDraw = i > 0;
				const last_elem = objs[i];

				for (let j = i + 1; j < objs.length; j++) {
					const element = objs[j];

					//- Skip if element is null
					if (null === element) continue;

					const cur_edge = [last_elem.toString(), element.toString()];

					//- Update rating value
					const [Source_rank, Target_rank] = cur_edge.map((e) => {
						return nodes.get(e);
					});

					//- Rating
					const [newP1, newP2] = rate_1vs1(Source_rank, Target_rank, isDraw);

					edges.push(cur_edge);
					nodes.set(cur_edge[0], newP1);
					nodes.set(cur_edge[1], newP2);
				}
			}
		});

		return new Ts_Rating(nodes, edges);
	} catch (error) {
		console.error(error.message);
	}
}
