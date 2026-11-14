import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "weyro-api";
export default defineRailway(() => {
  const weyroApi = service("weyro-api", {
    source: github("revanthrao92-debug/weyro"),
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "apps/api/Dockerfile" },
    start: "node apps/api/dist/main.js",
    healthcheck: "/api/v1/ready",
    healthcheckTimeout: 120,
    preDeploy: "npm run db:migrate:deploy",
    replicas: { "sfo": 1 },
  });

  return project("weyro", {
    variables: { managed: false },
    resources: [weyroApi],
  });
});
