import path from "path";
import fs from "fs";
import AJV from 'ajv';

const findJSONSchemasRoot = () : string[] =>
{
	if (fs.existsSync(path.join(__dirname, "..", "node_modules", "@halon", "json-schemas"))) {
		return [__dirname, "..", "node_modules", "@halon", "json-schemas"];
	} else {
		return [__dirname, "..", "..", "json-schemas"];
	}
}

export const validate = (config: { smtpd?: any, smtpd_app?: any, smtpd_policy?: any, smtpd_suspend?: any, smtpd_delivery?: any, rated?: any, rated_app?: any, dlpd?: any, dlpd_app?: any }) => 
{
	let ajv = new AJV();

	if (config.smtpd) {
		let smtpd = ajv.compile(JSON.parse(fs.readFileSync(path.join(...findJSONSchemasRoot(), "smtpd.schema.json")).toString()));
		if (!smtpd(config.smtpd)) throw { source: 'smtpd', errors: smtpd.errors };
	}

	if (config.smtpd_app) {
		let smtpd_app = ajv.compile(JSON.parse(fs.readFileSync(path.join(...findJSONSchemasRoot(), "smtpd-app.schema.json")).toString()));
		if (!smtpd_app(config.smtpd_app)) throw { source: 'smtpd-app', errors: smtpd_app.errors };
	}

	if (config.smtpd_policy) {
		let smtpd_policy = ajv.compile(JSON.parse(fs.readFileSync(path.join(...findJSONSchemasRoot(), "smtpd-policy.schema.json")).toString()));
		if (!smtpd_policy(config.smtpd_policy)) throw { source: 'smtpd-policy', errors: smtpd_policy.errors };
	}

	if (config.smtpd_suspend) {
		let smtpd_suspend = ajv.compile(JSON.parse(fs.readFileSync(path.join(...findJSONSchemasRoot(), "smtpd-suspend.schema.json")).toString()));
		if (!smtpd_suspend(config.smtpd_suspend)) throw { source: 'smtpd-suspend', errors: smtpd_suspend.errors };
	}

	if (config.smtpd_delivery) {
		let smtpd_delivery = ajv.compile(JSON.parse(fs.readFileSync(path.join(...findJSONSchemasRoot(), "smtpd-delivery.schema.json")).toString()));
		if (!smtpd_delivery(config.smtpd_delivery)) throw { source: 'smtpd-delivery', errors: smtpd_delivery.errors };
	}

	if (config.rated) {
		let rated = ajv.compile(JSON.parse(fs.readFileSync(path.join(...findJSONSchemasRoot(), "rated.schema.json")).toString()));
		if (!rated(config.rated)) throw { source: 'rated', errors: rated.errors };
	}

	if (config.rated_app) {
		let rated_app = ajv.compile(JSON.parse(fs.readFileSync(path.join(...findJSONSchemasRoot(), "rated-app.schema.json")).toString()));
		if (!rated_app(config.rated_app)) throw { source: 'rated-app', errors: rated_app.errors };
	}

	if (config.dlpd) {
		let dlpd = ajv.compile(JSON.parse(fs.readFileSync(path.join(...findJSONSchemasRoot(), "dlpd.schema.json")).toString()));
		if (!dlpd(config.dlpd)) throw { source: 'dlpd', errors: dlpd.errors };
	}

	if (config.dlpd_app) {
		let dlpd_app = ajv.compile(JSON.parse(fs.readFileSync(path.join(...findJSONSchemasRoot(), "dlpd-app.schema.json")).toString()));
		if (!dlpd_app(config.dlpd_app)) throw { source: 'dlpd-app', errors: dlpd_app.errors };
	}
}