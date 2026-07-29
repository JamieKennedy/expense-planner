var builder = DistributedApplication.CreateBuilder(args);

var postgresPassword = builder.AddParameter(
    "postgres-password",
    new GenerateParameterDefault(),
    secret: true,
    persist: true);

var postgres = builder.AddPostgres("postgres", password: postgresPassword)
    .WithImage("postgres", "18")
    .WithDataVolume()
    .AddDatabase("expense-planner");
var redis = builder.AddRedis("cache")
    .WithImage("redis", "8.2-alpine")
    .WithDataVolume();

var api = builder.AddProject<Projects.ExpensePlanner_Api>("api")
    .WithReference(postgres)
    .WithReference(redis)
    .WaitFor(postgres)
    .WaitFor(redis)
    .WithHttpHealthCheck("/health");

builder.AddJavaScriptApp("frontend", "../../frontend", "dev")
    .WithPnpm()
    .WithReference(api)
    .WithEnvironment("API_INTERNAL_URL", api.GetEndpoint("http"))
    .WithHttpEndpoint(env: "PORT", port: 3000)
    .WaitFor(api);

builder.Build().Run();
