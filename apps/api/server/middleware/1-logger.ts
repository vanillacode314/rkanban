import pino from 'pino-http';
export default fromNodeMiddleware(
	pino({
		serializers: {
			req: (req: Request) => {
				if (process.env.NODE_ENV === 'development') {
					return `[${req.method}] ${decodeURIComponent(req.url)}`;
				} else {
					return req;
				}
			}
		}
	})
);
