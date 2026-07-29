FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /source
COPY . .
RUN dotnet restore ExpensePlanner.slnx --locked-mode
RUN dotnet publish src/backend/ExpensePlanner.Api/ExpensePlanner.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /out/api
RUN dotnet publish src/backend/ExpensePlanner.Admin/ExpensePlanner.Admin.csproj \
    --configuration Release \
    --no-restore \
    --output /out/admin

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS api
WORKDIR /app
USER root
RUN apt-get update \
    && apt-get install --yes --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/api .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "ExpensePlanner.Api.dll"]

FROM mcr.microsoft.com/dotnet/runtime:10.0 AS admin
WORKDIR /app
COPY --from=build /out/admin .
USER $APP_UID
ENTRYPOINT ["dotnet", "ExpensePlanner.Admin.dll"]
