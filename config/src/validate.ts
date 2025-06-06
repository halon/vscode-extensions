import AJV from "ajv";
import * as fs from "fs";
import * as path from "path";

export const validate = (config: {
  smtpd?: any;
  smtpd_app?: any;
  smtpd_policy?: any;
  smtpd_suspend?: any;
  smtpd_delivery?: any;
  halonctl?: any;
  rated?: any;
  rated_app?: any;
  ratectl?: any;
  dlpd?: any;
  dlpd_app?: any;
  dlpctl?: any;
  api?: any;
  web?: any;
  submission?: any;
  submission_tracking?: any;
  clusterd?: any;
}) => {
  let ajv = new AJV();

  const configs = [
    ["smtpd", "smtpd.schema.json"],
    ["smtpd_app", "smtpd-app.schema.json"],
    ["smtpd_policy", "smtpd-policy.schema.json"],
    ["smtpd_suspend", "smtpd-suspend.schema.json"],
    ["smtpd_delivery", "smtpd-delivery.schema.json"],
    ["halonctl", "halonctl.schema.json"],
    ["rated", "rated.schema.json"],
    ["rated_app", "rated-app.schema.json"],
    ["ratectl", "ratectl.schema.json"],
    ["dlpd", "dlpd.schema.json"],
    ["dlpd_app", "dlpd-app.schema.json"],
    ["dlpctl", "dlpctl.schema.json"],
    ["api", "api.schema.json"],
    ["web", "web.schema.json"],
    ["submission", "submission.schema.json"],
    ["submission_tracking", "submission-tracking.schema.json"],
    ["clusterd", "clusterd.schema.json"],
  ];

  for (const [source, file] of configs) {
    if (config[source]) {
      if (!config[source].version) {
        throw new Error(`${source}: "Missing version"`);
      }
      const project =
        source === "submission_tracking"
          ? "submission-tracking"
          : source === "rated_app" || source === "ratectl"
            ? "rated"
            : source === "dlpd_app" || source === "dlpctl"
              ? "dlpd"
              : source === "web" ||
                  source === "api" ||
                  source === "submission" ||
                  source === "rated" ||
                  source === "dlpd"
                ? source
                : "mta";
      let schemaPath = path.join(
        __dirname,
        "json-schemas",
        project,
        `${config[source].version}-stable`,
        file,
      );
      if (!fs.existsSync(schemaPath)) {
        schemaPath = path.join(
          __dirname,
          "json-schemas",
          project,
          `${config[source].version}`,
          file,
        );
        if (!fs.existsSync(schemaPath)) {
          throw new Error(`${source}: "Unknown version"`);
        }
      }
      const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
      const result = ajv.compile(schema);
      if (!result(config[source])) {
        throw new Error(`${source}: ${JSON.stringify(result.errors)}`);
      }
    }
  }
};
