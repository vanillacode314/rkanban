import { nanoid } from 'nanoid';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	diffBoards,
	diffNodes,
	getNodePath,
	type TStrippedBoard,
	type TStrippedNode
} from '~/routes/(root)/settings.utils';
import { readNthLineFromFile } from './utils/fs';

const generateWord = () =>
	readNthLineFromFile(path.join(__dirname, '../public/words.txt'), Math.floor(Math.random() * 100));

const generateNode = async (
	node: Partial<TStrippedNode> & Pick<TStrippedNode, 'parentId'>
): Promise<TStrippedNode> => ({
	id: nanoid(),
	name: await generateWord(),
	updatedAt: new Date(),
	...node
});

const generateNodes = async (
	...nodes: Array<Partial<TStrippedNode> & Pick<TStrippedNode, 'parentId'>>
) => await Promise.all(nodes.map(generateNode));

describe('getNodePath', () => {
	it('should return / for root node', async () => {
		const node = await generateNode({ parentId: null });
		const nodeMap = new Map<string, TStrippedNode>([[node.id, node]]);
		expect(getNodePath(node, nodeMap)).toEqual('/');
	});
	it('should handle folder in root node', async () => {
		const parent = await generateNode({ parentId: null });
		const child = await generateNode({ parentId: parent.id });
		const nodeMap = new Map<string, TStrippedNode>([
			[parent.id, parent],
			[child.id, child]
		]);
		expect(getNodePath(child, nodeMap)).toEqual(`/${child.name}`);
	});
	it('should handle deeply nested nodes', async () => {
		const parent = await generateNode({ parentId: null });
		const child = await generateNode({ parentId: parent.id });
		const grandchild = await generateNode({ parentId: child.id });
		const grandgrandchild = await generateNode({ parentId: grandchild.id });

		const nodeMap = new Map<string, TStrippedNode>([
			[parent.id, parent],
			[child.id, child],
			[grandchild.id, grandchild]
		]);
		expect(getNodePath(grandchild, nodeMap)).toEqual(`/${child.name}/${grandchild.name}`);
		expect(getNodePath(grandgrandchild, nodeMap)).toEqual(
			`/${child.name}/${grandchild.name}/${grandgrandchild.name}`
		);
	});
	it('should error on id not found in nodeMap', async () => {
		const parent = await generateNode({ parentId: null });
		const child = await generateNode({ parentId: parent.id });
		const grandchild = await generateNode({ parentId: child.id });
		const nodeMap = new Map<string, TStrippedNode>([
			[parent.id, parent],
			[grandchild.id, grandchild]
		]);
		expect(() => getNodePath(grandchild, nodeMap)).toThrowError();
	});
});

describe('diffNodes', () => {
	it('should not return root node', async () => {
		const sources = await generateNodes({ id: '0', parentId: null });
		const destinations = await generateNodes({ id: '0', parentId: null });
		expect(diffNodes(sources, destinations)).toEqual({ nodes: [], changedIdsMap: new Map() });
	});
	it('should have root node id in changedIdsMap', async () => {
		const sources = await generateNodes({ parentId: null });
		const destinations = await generateNodes({ parentId: null });
		expect(diffNodes(sources, destinations)).toEqual({
			nodes: [],
			changedIdsMap: new Map([[sources[0].id, destinations[0].id]])
		});
	});
	it('should handle empty source', async () => {
		const sources: TStrippedNode[] = [];
		const destinations = await generateNodes({ parentId: '0' });
		expect(diffNodes(sources, destinations)).toEqual({
			nodes: [],
			changedIdsMap: new Map()
		});
	});
	it('should handle empty destination', async () => {
		const sources = await generateNodes({ parentId: '0' });
		const destinations: TStrippedNode[] = [];
		expect(diffNodes(sources, destinations)).toEqual({
			nodes: sources,
			changedIdsMap: new Map()
		});
	});
	it('should handle both source and destination empty', () => {
		const sources: TStrippedNode[] = [];
		const destinations: TStrippedNode[] = [];
		expect(diffNodes(sources, destinations)).toEqual({ nodes: [], changedIdsMap: new Map() });
	});
	it('should return changedIds on path conflict', async () => {
		const now = new Date();
		const rootNode = await generateNode({ parentId: null });
		const sources: TStrippedNode[] = await generateNodes(rootNode, {
			id: '0',
			parentId: rootNode.id,
			name: 'apple',
			updatedAt: now
		});
		const destinations: TStrippedNode[] = await generateNodes(rootNode, {
			id: '1',
			parentId: rootNode.id,
			name: 'apple',
			updatedAt: now
		});
		expect(diffNodes(sources, destinations)).toEqual({
			nodes: [],
			changedIdsMap: new Map([['0', '1']])
		});
	});
	it('should return nodes in source that are not in destination', async () => {
		const now = new Date();
		const rootNode = await generateNode({ parentId: null });
		const sources: TStrippedNode[] = await generateNodes(rootNode, {
			id: '0',
			parentId: rootNode.id,
			name: 'source',
			updatedAt: now
		});
		const destinations: TStrippedNode[] = await generateNodes(rootNode, {
			id: '1',
			parentId: rootNode.id,
			name: 'destination',
			updatedAt: now
		});
		const result = diffNodes(sources, destinations);
		result.nodes.sort((a, b) => a.id.localeCompare(b.id));
		expect(result).toEqual({
			nodes: [sources[1]].sort((a, b) => a.id.localeCompare(b.id)),
			changedIdsMap: new Map()
		});
	});
	it('should never return nodes in destination', async () => {
		const rootNode = await generateNode({ parentId: null });
		const sources: TStrippedNode[] = await generateNodes(rootNode, {
			parentId: rootNode.id,
			name: 'source'
		});
		const destinations: TStrippedNode[] = await generateNodes(
			rootNode,
			{ parentId: rootNode.id, name: 'destination1' },
			{ parentId: rootNode.id, name: 'destination2' },
			{ parentId: rootNode.id, name: 'destination3' },
			{ parentId: rootNode.id, name: 'destination4' },
			{ parentId: rootNode.id, name: 'destination5' },
			{ parentId: rootNode.id, name: 'destination6' }
		);
		expect(diffNodes([], destinations)).toEqual({ nodes: [], changedIdsMap: new Map() });
		expect(diffNodes(sources, destinations)).toEqual({
			nodes: [sources[1]],
			changedIdsMap: new Map()
		});
	});
});

const generateBoard = async (
	board: Partial<TStrippedBoard> & Pick<TStrippedBoard, 'index' | 'nodeId'>
): Promise<TStrippedBoard> => ({
	id: nanoid(),
	title: await generateWord(),
	updatedAt: new Date(),
	...board
});

const generateBoards = async (
	...boards: Array<Partial<TStrippedBoard> & Pick<TStrippedBoard, 'index' | 'nodeId'>>
) => await Promise.all(boards.map(generateBoard));

describe('diffBoards', () => {
	it('should handle empty source', async () => {
		const sources: TStrippedBoard[] = [];
		const destinations = await generateBoards({ index: 0, nodeId: '0' });
		expect(diffBoards(sources, destinations)).toEqual({ boards: [], changedIdsMap: new Map() });
	});
	it('should handle empty destination', async () => {
		const sources = await generateBoards({ index: 0, nodeId: '0' });
		const destinations: TStrippedBoard[] = [];
		expect(diffBoards(sources, destinations)).toEqual({
			boards: sources,
			changedIdsMap: new Map()
		});
	});
	it('should handle both source and destination empty', async () => {
		const sources: TStrippedBoard[] = [];
		const destinations: TStrippedBoard[] = [];
		expect(diffBoards(sources, destinations)).toEqual({
			boards: [],
			changedIdsMap: new Map()
		});
	});
	it('should return boards in sources that are not in destination', async () => {
		const sources = await generateBoards({ index: 1, nodeId: '0', title: 'source' });
		const destinations = await generateBoards({ index: 0, nodeId: '0', title: 'destination' });
		expect(diffBoards(sources, destinations)).toEqual({
			boards: [sources[0]],
			changedIdsMap: new Map()
		});
	});
	it('should update source indices to be after destination', async () => {
		const sources = await generateBoards({ index: 0, nodeId: '0', title: 'source' });
		const destinations = await generateBoards({ index: 0, nodeId: '0', title: 'destination' });
		expect(diffBoards(sources, destinations)).toEqual({
			boards: [{ ...sources[0], index: 1 }],
			changedIdsMap: new Map()
		});
	});
	it('should append .restored to sources and generate new id if a destination board has conflicting id', async () => {
		const sources = await generateBoards(
			{
				id: '0',
				index: 0,
				nodeId: '0',
				title: 'source1'
			},
			{
				id: '1',
				index: 1,
				nodeId: '0',
				title: 'source2'
			}
		);
		const destinations = await generateBoards(
			{
				id: sources[0].id,
				index: 0,
				nodeId: '0'
			},
			{ id: sources[1].id, nodeId: '0', index: 1, title: 'source2' },
			{ nodeId: '0', index: 2, title: 'source2.restored' }
		);
		const result = diffBoards(sources, destinations);
		expect(result.boards[0].title).toBe(`${sources[0].title}`);
		expect(result.boards[1].title).toBe(`${sources[1].title}.restored.restored`);
		expect(result.boards[0].id).not.toBe(sources[0].id);
		expect(result.changedIdsMap.has(sources[0].id)).toBe(true);
	});
	it('should append .restored to sources if a destination board has conflicting title (case-insensitive)', async () => {
		const sources = await generateBoards({ index: 0, nodeId: '0', title: 'source.restored' });
		const destinations = await generateBoards({
			index: 0,
			nodeId: '0',
			title: sources[0].title.toUpperCase()
		});
		expect(diffBoards(sources, destinations)).toEqual({
			boards: [{ ...sources[0], index: 1, title: `${sources[0].title}.restored` }],
			changedIdsMap: new Map()
		});
	});
	it('should never return boards in destination', async () => {
		const sources = await generateBoards({ index: 0, nodeId: '0', title: 'source' });
		const destinations = await generateBoards({ index: 0, nodeId: '0', title: 'destination' });
		expect(diffBoards([], destinations)).toEqual({
			boards: [],
			changedIdsMap: new Map()
		});
		expect(diffBoards(sources, destinations)).toEqual({
			boards: [{ ...sources[0], index: 1 }],
			changedIdsMap: new Map()
		});
	});
});
