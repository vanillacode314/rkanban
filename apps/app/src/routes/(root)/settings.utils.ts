import { nanoid } from 'nanoid';

import { TBoard, TNode, TTask } from '~/db/schema';

type TStrippedNode = Omit<TNode, 'createdAt' | 'userId'>;
type TStrippedBoard = Omit<TBoard, 'createdAt' | 'userId'>;
type TStrippedTask = Omit<TTask, 'createdAt' | 'userId'>;

/**
 * Utility to get path of a node
 * @param node - The node
 * @param nodeMap - A map consisting of all nodes with ids as keys and nodes as values
 * @returns The path of the node as a string
 */
function getNodePath(node: TStrippedNode, nodeMap: Map<string, TStrippedNode>): string {
	const path = [] as string[];
	let currentNode = node;
	if (currentNode.parentId === null) {
		return '/';
	}
	while (currentNode.parentId !== null) {
		path.push(currentNode.name);
		if (!nodeMap.has(currentNode.parentId)) {
			throw new Error(`Node ${currentNode.parentId} not found in nodeMap`);
		}
		currentNode = nodeMap.get(currentNode.parentId)!;
	}
	return '/' + path.reverse().join('/');
}

/**
 * Utility to merge nodes. Can be used to merge a json backup into the current db state
 * Assumes parents come before children in both arrays
 * @param sources - List of nodes to merge from, e.g. a json backup
 * @param destinations - List of nodes to merge into e.g. current db state
 * @returns List of merged nodes and a map of changed ids
 */
function diffNodes(
	sources: TStrippedNode[],
	destinations: TStrippedNode[]
): { changedIdsMap: Map<string, string>; nodes: TStrippedNode[] } {
	const changedIdsMap = new Map();
	if (sources.length === 0) return { changedIdsMap, nodes: [] };
	if (destinations.length === 0) return { changedIdsMap, nodes: sources };

	const sourceIdMap = new Map<string, TStrippedNode>();
	const sourcePathMap = new Map<string, string>();
	for (const source of sources) {
		sourceIdMap.set(source.id, source);
		const sourcePath = getNodePath(source, sourceIdMap);
		sourcePathMap.set(source.id, sourcePath);
	}
	const destinationIdMap = new Map<string, TStrippedNode>();
	const destinationPathMap = new Map<string, TStrippedNode>();
	for (const destination of destinations) {
		destinationIdMap.set(destination.id, destination);
		const destinationPath = getNodePath(destination, destinationIdMap);
		destinationPathMap.set(destinationPath, destination);
	}

	const nodes = [] as TStrippedNode[];
	for (const source of sources) {
		const sourcePath = sourcePathMap.get(source.id)!;
		const destination = destinationPathMap.get(sourcePath);
		if (!destination) {
			if (source.parentId !== null) nodes.push(source);
			continue;
		}
		if (source.id !== destination.id) {
			changedIdsMap.set(source.id, destination.id);
		}
	}
	return { changedIdsMap, nodes };
}

/**
 * Utility to merge boards. Can be used to merge a json backup into the current db state
 * @param sources - List of boards to merge from, e.g. a json backup
 * @param destinations - List of boards to merge into e.g. current db state
 * @returns List of merged boards
 */
function diffBoards(
	sources: TStrippedBoard[],
	destinations: TStrippedBoard[]
): { boards: TStrippedBoard[]; changedIdsMap: Map<string, string> } {
	const changedIdsMap = new Map();
	if (sources.length === 0) return { boards: [], changedIdsMap };
	if (destinations.length === 0) return { boards: sources, changedIdsMap };
	const destinationIds = new Set(destinations.map((destination) => destination.id));
	const destinationTitles = new Set(
		destinations.map((destination) => destination.title.toLowerCase())
	);
	const retval: TStrippedBoard[] = [];
	for (let [index, source] of sources.entries()) {
		if (destinationIds.has(source.id)) {
			let title = source.title;
			while (destinationTitles.has(title.toLowerCase())) {
				title = `${title}.restored`;
			}
			const id = nanoid();
			retval.push({
				...source,
				id,
				index: destinationIds.size + index,
				title
			});
			changedIdsMap.set(source.id, id);
			continue;
		}
		source = { ...source };
		source.index = destinationIds.size + index;
		while (destinationTitles.has(source.title.toLowerCase())) {
			source.title = `${source.title}.restored`;
		}
		retval.push(source);
	}
	return { boards: retval, changedIdsMap };
}

export { diffBoards, diffNodes, getNodePath };
export type { TStrippedBoard, TStrippedNode, TStrippedTask };
