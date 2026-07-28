var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres")
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
    .WithEnvironment("API_INTERNAL_URL", api.GetEndpoint("https"))
    .WithHttpEndpoint(env: "PORT", port: 3000)
    .WaitFor(api);

builder.Build().Run();
