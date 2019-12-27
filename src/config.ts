import * as fs from 'fs';

export const Config = (path: string) =>
{
	if (!fs.existsSync(path))
		return {};
	var config = JSON.parse(fs.readFileSync(path).toString());

	if (config.ssh2 && config.ssh2.agent && config.ssh2.agent[0] == '$')
		config.ssh2.agent = process.env[config.ssh2.agent.substr(1)];

	return config;
}