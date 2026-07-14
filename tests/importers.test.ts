import { describe, expect, it } from "vitest";
import { importArchitecture } from "../src/importers/index.js";

describe("architecture importers", () => {
  it("imports OpenAPI with security and transport evidence", () => {
    const result = importArchitecture(
      "payments.openapi.yaml",
      `openapi: 3.1.0
info:
  title: Payments API
  version: 1.0.0
servers:
  - url: https://api.example.test
security:
  - bearerAuth: []
paths:
  /payments:
    post:
      responses:
        "201": { description: created }
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer }
`,
    );
    expect(result.format).toBe("openapi");
    expect(result.model.nodes.some((node) => node.kind === "api")).toBe(true);
    expect(result.model.flows[0]).toMatchObject({ authenticated: true, encrypted: true });
    expect(result.model.nodes.every((node) => node.reviewStatus === "needs-review")).toBe(true);
  });

  it("imports Docker Compose dependencies without claiming they are confirmed flows", () => {
    const result = importArchitecture(
      "compose.yaml",
      `services:
  web:
    image: example/web:1.0
    ports: ["8080:8080"]
    depends_on: [db]
  db:
    image: postgres:17
`,
    );
    expect(result.format).toBe("docker-compose");
    expect(result.model.nodes.find((node) => node.name === "db")?.kind).toBe("data-store");
    expect(result.model.flows).toHaveLength(1);
    expect(result.model.flows[0]?.evidence[0]?.observation).toContain("requires confirmation");
  });

  it("imports Kubernetes workload, service and ingress relationships", () => {
    const result = importArchitecture(
      "app.yaml",
      `apiVersion: apps/v1
kind: Deployment
metadata: { name: api }
spec:
  selector: { matchLabels: { app: api } }
  template:
    metadata: { labels: { app: api } }
    spec:
      containers:
        - name: api
          image: example/api:1.0
          securityContext: { runAsNonRoot: true, readOnlyRootFilesystem: true }
---
apiVersion: v1
kind: Service
metadata: { name: api }
spec:
  selector: { app: api }
  ports: [{ port: 80 }]
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata: { name: api }
spec:
  tls: [{ hosts: [api.example.test] }]
  rules:
    - http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service: { name: api, port: { number: 80 } }
`,
    );
    expect(result.format).toBe("kubernetes");
    expect(result.model.nodes.map((node) => node.name)).toEqual(
      expect.arrayContaining(["api", "Internet client"]),
    );
    expect(result.model.flows.some((flow) => flow.protocol === "HTTPS")).toBe(true);
  });

  it("imports supported Terraform plan resources", () => {
    const result = importArchitecture(
      "plan.json",
      JSON.stringify({
        format_version: "1.2",
        planned_values: {
          root_module: {
            resources: [
              {
                address: "aws_lambda_function.processor",
                type: "aws_lambda_function",
                values: { function_name: "processor" },
              },
              {
                address: "aws_db_instance.customer",
                type: "aws_db_instance",
                values: { publicly_accessible: false },
              },
            ],
          },
        },
      }),
    );
    expect(result.format).toBe("terraform-plan");
    expect(result.model.nodes.map((node) => node.kind)).toEqual(
      expect.arrayContaining(["service", "data-store"]),
    );
  });

  it("imports MCP servers without copying secret values", () => {
    const result = importArchitecture(
      "mcp.json",
      JSON.stringify({
        mcpServers: {
          github: {
            url: "https://mcp.example.test/tools?token=url-secret-token",
            headers: { Authorization: "super-secret-token" },
          },
        },
      }),
    );
    expect(result.format).toBe("mcp-config");
    expect(result.model.systemKind).toBe("agentic");
    expect(JSON.stringify(result.model)).not.toContain("super-secret-token");
    expect(JSON.stringify(result.model)).not.toContain("url-secret-token");
    expect(result.model.flows[0]?.authenticated).toBe(true);
  });

  it("schema-validates generated importer output", () => {
    const oversizedName = "x".repeat(121);
    expect(() =>
      importArchitecture(
        "mcp.json",
        JSON.stringify({ mcpServers: { [oversizedName]: { command: "safe-command" } } }),
      ),
    ).toThrow("generated architecture is invalid");
  });

  it("rejects unsupported and oversized files", () => {
    expect(() => importArchitecture("notes.yaml", "hello: world")).toThrow("Unsupported");
    expect(() => importArchitecture("large.json", " ".repeat(2_000_001))).toThrow("2 MB");
  });
});
