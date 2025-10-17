import { text } from "express";
import dbClient from "./dataBase_Client.js";
import { rate_1vs1, Rating } from "ts-trueskill";

const _cache = new Map();
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

class Ts {
	static async createQuery(year = 111) {
		let data = _cache.get(year);

		//- Store into memory
		if (!_cache.has(year)) {
			data = await Promise.all([Ts.getNodes(year), Ts.getEdges(year)]);

			_cache.set(year, data);
		}

		return data;
	}

	//- Get all the schools (nodes)
	static async getNodes(year = 111) {
		let query = {
			text: `
				SELECT 
					校系代碼 AS id
				FROM public."Data_${year}"
			`,
			rowMode: "array"
		};
		let _query = await dbClient.query(query);

		//- NODES
		/* const nodes = new Map();
		_query.rows.forEach((team) => {
			//- split schools into teams
			if (team["id"] !== null) nodes.set(team["id"].toString(), new Rating());
		}); */

		return _query.rows;
	}
	static async getEdges(year = 111) {
		const query = {
			text: `
				SELECT 
					一,
					二,
					三,
					四,
					五,
					六
				FROM public.admission_${year}
			`,
			rowMode: "array",
		};

		//- EDGES
		const edges = [];
		let _query = await dbClient.query(query);

		_query.rows.forEach((match) => {
			for (let i = 0; i < match.length; i++) {
				const isDraw = i > 0;
				const last_elem = match[i];

				for (let j = i + 1; j < match.length; j++) {
					const element = match[j];

					//- Skip if element is null
					if (null === element) continue;

					//- Store into "edges"
					const cur_edge = [last_elem.toString(), element.toString(), isDraw];
					edges.push(cur_edge);
				}
			}
		});

		return edges;
	}

	//- Rate all the matches (EDGES)
	static async target_matching_Ratings(year = 111, target = "") {
		const matches = await Ts.target_matching(year, target, false);

		let edges = matches.map((x) => x.slice(0, 2));
		let uniqueIDs = [...new Set(edges.flat())];

		const ratings = new Map(uniqueIDs.map((x) => [x, new Rating()]));

		matches.forEach((x) => {
			const [winner, loser, isDraw] = x;
			const [newP1, newP2] = Ts.rate(
				[ratings.get(winner), ratings.get(loser)],
				isDraw
			);
			ratings.set(winner, newP1);
			ratings.set(loser, newP2);
		});

		return {
			nodes: [...ratings].map(x => {
				const [node, rating] = x;
				return [node, Ts.R_score(rating).toFixed(2)];
			}),
			edges: edges,
		};
	}

	//- Get edges around "target"
	static async target_matching(year = 111, target = "", slice = true) {
		const [, edges] = await Ts.createQuery(year);
		let cur_nodes = edges.filter((x) => x.includes(target));

		if (slice) cur_nodes = cur_nodes.map((x) => x.slice(0, 2));

		return cur_nodes; //- RETURN ['ID', 'ID' --, cutoff "isDraw"--]
	}

	/*
		cur_edge<ARRAY of pair Rating()<OBJECT>> : Current 1vs1 ex."[new rating(), new rating()]"
		isDraw<BOOL> : true/false
	*/
	static rate(cur_edge, isDraw = false) {
		//- Update rating value
		const [Source_rank, Target_rank] = cur_edge;
		const [newP1, newP2] = rate_1vs1(Source_rank, Target_rank, isDraw);

		return [newP1, newP2];
	}

	static R_score(rating) {
		const mu = rating.mu;
		const sigma = rating.sigma;
		return mu - 2 * sigma;
	}
}

export function Ts_matching_Ratings(year = 111, query_target) {
	return Ts.target_matching_Ratings(year, query_target);
};

export async function Ts_data(year = 111) {
	try {
		let [node_ids, edges] = await Ts.createQuery(year);

		const nodes = new Map();
		node_ids.forEach((team) => {
			//- split schools into teams
			if (team[0] !== null)
				nodes.set(team[0].toString(), new Rating());
		});

		edges.forEach((x) => {
			const [winner, loser, isDraw] = x;
			const [newP1, newP2] = Ts.rate(
				[nodes.get(winner), nodes.get(loser)],
				isDraw
			);
			nodes.set(winner, newP1);
			nodes.set(loser, newP2);
		});

		return new Ts_Rating(nodes, edges);
	} catch (error) {
		console.error(error);
	}
}
