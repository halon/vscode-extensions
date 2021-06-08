import AJV from 'ajv';
import smtpd_schema from '@halon/json-schemas/smtpd.schema.json';
import smtpd_app_schema from '@halon/json-schemas/smtpd-app.schema.json';
import smtpd_policy_schema from '@halon/json-schemas/smtpd-policy.schema.json';
import smtpd_suspend_schema from '@halon/json-schemas/smtpd-suspend.schema.json';
import smtpd_delivery_schema from '@halon/json-schemas/smtpd-delivery.schema.json';
import rated_schema from '@halon/json-schemas/rated.schema.json';
import rated_app_schema from '@halon/json-schemas/rated-app.schema.json';
import dlpd_schema from '@halon/json-schemas/dlpd.schema.json';
import dlpd_app_schema from '@halon/json-schemas/dlpd-app.schema.json';
import api_schema from '@halon/json-schemas/api.schema.json';
import web_schema from '@halon/json-schemas/web.schema.json';

export const validate = (
  config: {
    smtpd?: any,
    smtpd_app?: any,
    smtpd_policy?: any,
    smtpd_suspend?: any,
    smtpd_delivery?: any,
    rated?: any,
    rated_app?: any,
    dlpd?: any,
    dlpd_app?: any,
    api?: any,
    web?: any
  }
) => 
{
  let ajv = new AJV();

  if (config.smtpd) {
    let smtpd = ajv.compile(smtpd_schema);
    if (!smtpd(config.smtpd)) throw { source: 'smtpd', errors: smtpd.errors };
  }

  if (config.smtpd_app) {
    let smtpd_app = ajv.compile(smtpd_app_schema);
    if (!smtpd_app(config.smtpd_app)) throw { source: 'smtpd-app', errors: smtpd_app.errors };
  }

  if (config.smtpd_policy) {
    let smtpd_policy = ajv.compile(smtpd_policy_schema);
    if (!smtpd_policy(config.smtpd_policy)) throw { source: 'smtpd-policy', errors: smtpd_policy.errors };
  }

  if (config.smtpd_suspend) {
    let smtpd_suspend = ajv.compile(smtpd_suspend_schema);
    if (!smtpd_suspend(config.smtpd_suspend)) throw { source: 'smtpd-suspend', errors: smtpd_suspend.errors };
  }

  if (config.smtpd_delivery) {
    let smtpd_delivery = ajv.compile(smtpd_delivery_schema);
    if (!smtpd_delivery(config.smtpd_delivery)) throw { source: 'smtpd-delivery', errors: smtpd_delivery.errors };
  }

  if (config.rated) {
    let rated = ajv.compile(rated_schema);
    if (!rated(config.rated)) throw { source: 'rated', errors: rated.errors };
  }

  if (config.rated_app) {
    let rated_app = ajv.compile(rated_app_schema);
    if (!rated_app(config.rated_app)) throw { source: 'rated-app', errors: rated_app.errors };
  }

  if (config.dlpd) {
    let dlpd = ajv.compile(dlpd_schema);
    if (!dlpd(config.dlpd)) throw { source: 'dlpd', errors: dlpd.errors };
  }

  if (config.dlpd_app) {
    let dlpd_app = ajv.compile(dlpd_app_schema);
    if (!dlpd_app(config.dlpd_app)) throw { source: 'dlpd-app', errors: dlpd_app.errors };
  }

  if (config.api) {
    let api = ajv.compile(api_schema);
    if (!api(config.api)) throw { source: 'api', errors: api.errors };
  }

  if (config.web) {
    let web = ajv.compile(web_schema);
    if (!web(config.web)) throw { source: 'web', errors: web.errors };
  }
}