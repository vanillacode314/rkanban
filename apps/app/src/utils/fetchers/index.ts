import { getRequestEvent } from 'solid-js/web';

interface TFetcher {
	(path: string, init?: RequestInit): Promise<Response>;
	appendHeaders: (headers: Record<string, string>) => TFetcher;
	as_json: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
	forwardHeaders: () => TFetcher;
	setHeaders: (headers: HeadersInit) => TFetcher;
}

function createFetcher(baseUrl: string, defaultInit: RequestInit = {}): TFetcher {
	const fetcher: TFetcher = Object.assign(
		async (path: string, init: RequestInit = {}) => {
			const response = await fetch(`${baseUrl}${path}`, {
				...defaultInit,
				...init
			});
			if (!response.ok) throw new FetchError(response);
			return response;
		},
		{
			appendHeaders: (headers: Record<string, string>) => {
				return fetcher.setHeaders({ ...defaultInit.headers, ...headers });
			},
			as_json: async <T = unknown>(path: string, init: RequestInit = {}): Promise<T> => {
				return await fetcher(path, init).then((r) => r.json());
			},
			forwardHeaders: () => {
				const event = getRequestEvent();
				const headers = event?.request.headers;
				if (!headers) return fetcher;
				return fetcher.setHeaders(headers);
			},
			setHeaders: (headers: HeadersInit) => {
				return createFetcher(baseUrl, { ...defaultInit, headers });
			}
		}
	);
	return fetcher;
}

const apiFetch = createFetcher('');

class FetchError extends Error {
	response: Response;
	status: number;

	constructor(response: Response) {
		super(`Bad response while fetching data: ${response.status} ${response.statusText}`);
		this.name = 'FetchError';
		this.response = response;
		this.status = response.status;
	}
}

export { apiFetch, FetchError };
