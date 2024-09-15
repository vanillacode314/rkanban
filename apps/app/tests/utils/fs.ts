import fs from 'node:fs';
import readline from 'node:readline/promises';

async function readNthLineFromFile(filepath: string, line_no: number): Promise<string> {
	const rl = readline.createInterface({
		input: fs.createReadStream(filepath)
	});

	for await (const line of rl) {
		if (--line_no < 0) {
			return line;
		}
	}
	throw new Error(`No line ${line_no} in ${filepath}`);
}

export { readNthLineFromFile };
