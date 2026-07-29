using ExpensePlanner.Application.Abstractions;
using ExpensePlanner.Application.Commitments;
using ExpensePlanner.Application.Common;
using ExpensePlanner.Application.Identity;
using ExpensePlanner.Application.Reporting;
using ExpensePlanner.Domain.Common;
using ExpensePlanner.Domain.Planning;
using ExpensePlanner.Infrastructure;
using ExpensePlanner.Infrastructure.Identity;
using ExpensePlanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace ExpensePlanner.IntegrationTests;

public sealed class PostgreSqlSchemaTests
{
    [Fact]
    public void Authentication_cookie_names_are_valid_for_each_transport()
    {
        Assert.Equal("expense-access", AuthCookies.AccessToken(secure: false));
        Assert.Equal("expense-refresh", AuthCookies.RefreshToken(secure: false));
        Assert.Equal("__Host-expense-access", AuthCookies.AccessToken(secure: true));
        Assert.Equal("__Secure-expense-refresh", AuthCookies.RefreshToken(secure: true));
        Assert.Equal("expense-csrf", AuthCookies.CsrfToken);
    }

    [Fact]
    public async Task Initial_migration_creates_a_queryable_schema()
    {
        if (!string.Equals(
                Environment.GetEnvironmentVariable("RUN_INTEGRATION_TESTS"),
                "true",
                StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        await using var postgres = new PostgreSqlBuilder()
            .WithImage("postgres:18-alpine")
            .Build();
        await postgres.StartAsync();
        var options = new DbContextOptionsBuilder<ExpensePlannerDbContext>()
            .UseNpgsql(postgres.GetConnectionString())
            .Options;
        await using var dbContext = new ExpensePlannerDbContext(options);

        await dbContext.Database.MigrateAsync();

        Assert.Empty(await dbContext.Planners.ToArrayAsync());
        Assert.True(await dbContext.Database.CanConnectAsync());
    }

    [Fact]
    public async Task First_owner_registration_is_available_exactly_once()
    {
        if (!IntegrationTestsEnabled())
        {
            return;
        }

        await using var postgres = new PostgreSqlBuilder()
            .WithImage("postgres:18-alpine")
            .Build();
        await postgres.StartAsync();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:expense-planner"] = postgres.GetConnectionString(),
                ["ConnectionStrings:cache"] = "localhost:6379",
            })
            .Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddInfrastructure(configuration);
        services.AddSingleton<IPlannerContext, NoPlannerContext>();

        await using var provider = services.BuildServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<ExpensePlannerDbContext>()
            .Database.MigrateAsync();
        var identity = scope.ServiceProvider.GetRequiredService<IIdentityModule>();

        Assert.True(await identity.IsRegistrationOpenAsync(CancellationToken.None));

        var registration = await identity.RegisterFirstOwnerAsync(
            "owner@example.com",
            CancellationToken.None);

        Assert.False(await identity.IsRegistrationOpenAsync(CancellationToken.None));
        var ownerContributor = await scope.ServiceProvider
            .GetRequiredService<ExpensePlannerDbContext>()
            .Contributors
            .SingleAsync();
        Assert.Equal("Me", ownerContributor.Name);
        Assert.True(ownerContributor.IsOwner);
        async Task<MfaSetupResult> PrepareInFreshScopeAsync()
        {
            await using var preparationScope = provider.CreateAsyncScope();
            return await preparationScope.ServiceProvider
                .GetRequiredService<IIdentityModule>()
                .PrepareSetupAsync(registration.SetupCode, CancellationToken.None);
        }

        var concurrentSetups = await Task.WhenAll(
            PrepareInFreshScopeAsync(),
            PrepareInFreshScopeAsync());
        var setup = concurrentSetups[0];
        Assert.Equal("owner@example.com", setup.Email);
        Assert.Equal(setup.SharedKey, concurrentSetups[1].SharedKey);
        var repeatedSetup = await PrepareInFreshScopeAsync();
        Assert.Equal(setup.SharedKey, repeatedSetup.SharedKey);
        await Assert.ThrowsAsync<ConflictException>(() =>
            identity.RegisterFirstOwnerAsync(
                "second@example.com",
                CancellationToken.None));
    }

    [Fact]
    public async Task Budget_reconciliation_persists_edits_shares_and_an_empty_template()
    {
        if (!IntegrationTestsEnabled())
        {
            return;
        }

        await using var postgres = new PostgreSqlBuilder()
            .WithImage("postgres:18-alpine")
            .Build();
        await postgres.StartAsync();
        var options = new DbContextOptionsBuilder<ExpensePlannerDbContext>()
            .UseNpgsql(postgres.GetConnectionString())
            .Options;
        var plannerId = Guid.NewGuid();
        var planner = new Planner(plannerId, "Planner");
        var retainedTag = new Tag(plannerId, "Household", "#14b8a6");
        var removedTag = new Tag(plannerId, "Personal", "#8b5cf6");
        var owner = new Contributor(plannerId, "Me", isOwner: true);
        var contributor = new Contributor(plannerId, "Partner");
        var template = new BudgetTemplate(plannerId);
        template.ReplaceLines(
        [
            new BudgetLineValue(
                "Household",
                10_000,
                retainedTag.Id,
                [new ContributorShareValue(owner.Id, 10_000)]),
            new BudgetLineValue(
                "Personal",
                5_000,
                removedTag.Id,
                [new ContributorShareValue(owner.Id, 10_000)]),
        ]);

        await using (var setup = new ExpensePlannerDbContext(options))
        {
            await setup.Database.MigrateAsync();
            setup.AddRange(planner, retainedTag, removedTag, owner, contributor, template);
            await setup.SaveChangesAsync();
        }

        Guid retainedLineId;
        await using (var update = new ExpensePlannerDbContext(options))
        {
            var persisted = await update.BudgetTemplates
                .Include(item => item.Lines)
                .ThenInclude(item => item.ContributorShares)
                .SingleAsync(item => item.PlannerId == plannerId);
            retainedLineId = persisted.Lines
                .Single(item => item.TagId == retainedTag.Id)
                .Id;

            persisted.ReplaceLines(
            [
                new BudgetLineValue(
                    "Shared household",
                    12_500,
                    retainedTag.Id,
                    [
                        new ContributorShareValue(owner.Id, 6_000),
                        new ContributorShareValue(contributor.Id, 4_000),
                    ]),
            ]);
            await update.SaveChangesAsync();
        }

        await using (var verifyUpdate = new ExpensePlannerDbContext(options))
        {
            var persisted = await verifyUpdate.BudgetTemplates
                .Include(item => item.Lines)
                .ThenInclude(item => item.ContributorShares)
                .SingleAsync(item => item.PlannerId == plannerId);
            var line = Assert.Single(persisted.Lines);
            Assert.Equal(retainedLineId, line.Id);
            Assert.Equal("Shared household", line.Name);
            Assert.Equal(12_500, line.AllowancePence);
            Assert.Equal(
                [6_000, 4_000],
                line.ContributorShares
                    .OrderBy(item => item.ContributorId == owner.Id ? 0 : 1)
                    .Select(item => item.BasisPoints)
                    .ToArray());

            persisted.ReplaceLines([]);
            await verifyUpdate.SaveChangesAsync();
        }

        await using var verifyDelete = new ExpensePlannerDbContext(options);
        var emptyTemplate = await verifyDelete.BudgetTemplates
            .Include(item => item.Lines)
            .SingleAsync(item => item.PlannerId == plannerId);
        Assert.Empty(emptyTemplate.Lines);
    }

    [Fact]
    public async Task Budget_module_attaches_new_lines_and_shares_as_one_graph()
    {
        if (!IntegrationTestsEnabled())
        {
            return;
        }

        await using var postgres = new PostgreSqlBuilder()
            .WithImage("postgres:18-alpine")
            .Build();
        await postgres.StartAsync();
        var options = new DbContextOptionsBuilder<ExpensePlannerDbContext>()
            .UseNpgsql(postgres.GetConnectionString())
            .Options;
        var plannerId = Guid.NewGuid();
        var firstTag = new Tag(plannerId, "Household", "#14b8a6");
        var secondTag = new Tag(plannerId, "Personal", "#8b5cf6");
        var replacementTag = new Tag(plannerId, "Travel", "#0ea5e9");
        var owner = new Contributor(plannerId, "Me", isOwner: true);
        var partner = new Contributor(plannerId, "Partner");

        await using (var setup = new ExpensePlannerDbContext(options))
        {
            await setup.Database.MigrateAsync();
            setup.AddRange(
                new Planner(plannerId, "Planner"),
                firstTag,
                secondTag,
                replacementTag,
                owner,
                partner);
            await setup.SaveChangesAsync();
        }

        var firstRequest = BudgetRequest(
            ("Household", 10_000, firstTag.Id, [(owner.Id, 10_000)]));
        Guid firstLineId;
        await using (var firstCreate = new ExpensePlannerDbContext(options))
        {
            var states = CaptureBudgetStates(firstCreate);
            var result = await Module(firstCreate, plannerId)
                .ReplaceBudgetAsync(firstRequest, CancellationToken.None);
            firstLineId = Assert.Single(result.Lines).Id;

            Assert.Contains(
                states,
                state => state.EntityType == nameof(BudgetLine) &&
                         state.State == EntityState.Added);
            Assert.Contains(
                states,
                state => state.EntityType == nameof(BudgetLineContributorShare) &&
                         state.State == EntityState.Added);
        }

        await using (var addAndEdit = new ExpensePlannerDbContext(options))
        {
            var states = CaptureBudgetStates(addAndEdit);
            var result = await Module(addAndEdit, plannerId).ReplaceBudgetAsync(
                BudgetRequest(
                    ("Shared household", 12_500, firstTag.Id,
                        [(owner.Id, 6_000), (partner.Id, 4_000)]),
                    ("Personal", 5_000, secondTag.Id, [(owner.Id, 10_000)])),
                CancellationToken.None);

            Assert.Equal(
                firstLineId,
                result.Lines.Single(line => line.TagId == firstTag.Id).Id);
            Assert.Contains(
                states,
                state => state.EntityType == nameof(BudgetLine) &&
                         state.State == EntityState.Added);
            Assert.Contains(
                states,
                state => state.EntityType == nameof(BudgetLineContributorShare) &&
                         state.State == EntityState.Added);
            Assert.DoesNotContain(
                states,
                state => state.EntityType == nameof(BudgetLine) &&
                         state.Id == firstLineId &&
                         state.State == EntityState.Added);
        }

        await using (var verifyEdit = new ExpensePlannerDbContext(options))
        {
            var persisted = await verifyEdit.BudgetTemplates
                .AsNoTracking()
                .Include(template => template.Lines)
                .ThenInclude(line => line.ContributorShares)
                .SingleAsync(template => template.PlannerId == plannerId);
            var retained = persisted.Lines.Single(line => line.TagId == firstTag.Id);
            Assert.Equal(firstLineId, retained.Id);
            Assert.Equal("Shared household", retained.Name);
            Assert.Equal(12_500, retained.AllowancePence);
            Assert.Equal(
                [6_000, 4_000],
                retained.ContributorShares
                    .OrderBy(share => share.ContributorId == owner.Id ? 0 : 1)
                    .Select(share => share.BasisPoints)
                    .ToArray());
        }

        Guid secondLineId;
        await using (var deleteLine = new ExpensePlannerDbContext(options))
        {
            var existing = await deleteLine.BudgetLines
                .AsNoTracking()
                .SingleAsync(line => line.TagId == secondTag.Id);
            secondLineId = existing.Id;
            var states = CaptureBudgetStates(deleteLine);
            await Module(deleteLine, plannerId).ReplaceBudgetAsync(
                BudgetRequest(
                    ("Shared household", 12_500, firstTag.Id,
                        [(owner.Id, 10_000)])),
                CancellationToken.None);

            Assert.Contains(
                states,
                state => state.EntityType == nameof(BudgetLine) &&
                         state.Id == secondLineId &&
                         state.State == EntityState.Deleted);
        }

        await using (var emptyTemplate = new ExpensePlannerDbContext(options))
        {
            await Module(emptyTemplate, plannerId).ReplaceBudgetAsync(
                new ReplaceBudgetRequest([]),
                CancellationToken.None);
        }

        await using (var addToEmpty = new ExpensePlannerDbContext(options))
        {
            var states = CaptureBudgetStates(addToEmpty);
            var result = await Module(addToEmpty, plannerId).ReplaceBudgetAsync(
                BudgetRequest(
                    ("Personal again", 7_000, secondTag.Id,
                        [(owner.Id, 5_000), (partner.Id, 5_000)])),
                CancellationToken.None);

            Assert.NotEqual(secondLineId, Assert.Single(result.Lines).Id);
            Assert.Contains(
                states,
                state => state.EntityType == nameof(BudgetLine) &&
                         state.State == EntityState.Added);
            Assert.Contains(
                states,
                state => state.EntityType == nameof(BudgetLineContributorShare) &&
                         state.State == EntityState.Added);
        }

        await using (var changeTag = new ExpensePlannerDbContext(options))
        {
            var oldLineId = await changeTag.BudgetLines
                .AsNoTracking()
                .Where(line => line.TagId == secondTag.Id)
                .Select(line => line.Id)
                .SingleAsync();
            var states = CaptureBudgetStates(changeTag);
            var result = await Module(changeTag, plannerId).ReplaceBudgetAsync(
                BudgetRequest(
                    ("Travel", 9_000, replacementTag.Id, [(owner.Id, 10_000)])),
                CancellationToken.None);
            var replacement = Assert.Single(result.Lines);

            Assert.NotEqual(oldLineId, replacement.Id);
            Assert.Contains(
                states,
                state => state.EntityType == nameof(BudgetLine) &&
                         state.Id == oldLineId &&
                         state.State == EntityState.Deleted);
            Assert.Contains(
                states,
                state => state.EntityType == nameof(BudgetLine) &&
                         state.Id == replacement.Id &&
                         state.State == EntityState.Added);
        }

        await using var verifyFinal = new ExpensePlannerDbContext(options);
        var canonical = await Module(verifyFinal, plannerId)
            .GetBudgetAsync(CancellationToken.None);
        var finalLine = Assert.Single(canonical.Lines);
        Assert.Equal("Travel", finalLine.Name);
        Assert.Equal(9_000, finalLine.AllowancePence);
        Assert.Equal(replacementTag.Id, finalLine.TagId);
        Assert.Equal(10_000, Assert.Single(finalLine.ContributorShares).BasisPoints);
    }

    [Fact]
    public async Task Expense_and_report_modules_expand_definitions_for_the_requested_month()
    {
        if (!IntegrationTestsEnabled())
        {
            return;
        }

        await using var postgres = new PostgreSqlBuilder()
            .WithImage("postgres:18-alpine")
            .Build();
        await postgres.StartAsync();
        var options = new DbContextOptionsBuilder<ExpensePlannerDbContext>()
            .UseNpgsql(postgres.GetConnectionString())
            .Options;
        var plannerId = Guid.NewGuid();
        var foreignPlannerId = Guid.NewGuid();
        var account = new Account(plannerId, "Current");
        var foreignAccount = new Account(foreignPlannerId, "Foreign");
        var tag = new Tag(plannerId, "Bills", "#14b8a6");
        var foreignTag = new Tag(foreignPlannerId, "Foreign", "#8b5cf6");
        var owner = new Contributor(plannerId, "Me", isOwner: true);
        var partner = new Contributor(plannerId, "Partner");
        var foreignOwner = new Contributor(foreignPlannerId, "Me", isOwner: true);
        var ownerShare = new[] { new ContributorShareValue(owner.Id, 10_000) };
        var shared = new[]
        {
            new ContributorShareValue(owner.Id, 5_000),
            new ContributorShareValue(partner.Id, 5_000),
        };
        var boundedMonthly = new Expense(
            plannerId,
            "Monthly",
            2_000,
            account.Id,
            new ExpenseScheduleValue(
                ExpenseFrequency.Monthly,
                new DateOnly(2026, 4, 1),
                5,
                false),
            [tag.Id],
            ownerShare);
        var legacyMonthly = new Expense(
            plannerId,
            "Legacy monthly",
            100,
            account.Id,
            new ExpenseScheduleValue(
                ExpenseFrequency.Monthly,
                null,
                12,
                false),
            [tag.Id],
            ownerShare);
        var budget = new BudgetTemplate(plannerId);
        budget.ReplaceLines(
        [
            new BudgetLineValue("Bills", 10_000, tag.Id, ownerShare),
        ]);

        await using (var setup = new ExpensePlannerDbContext(options))
        {
            await setup.Database.MigrateAsync();
            setup.AddRange(
                new Planner(plannerId, "Planner"),
                new Planner(foreignPlannerId, "Foreign planner"),
                account,
                foreignAccount,
                tag,
                foreignTag,
                owner,
                partner,
                foreignOwner,
                new Expense(
                    plannerId,
                    "One off",
                    1_000,
                    account.Id,
                    new ExpenseScheduleValue(
                        null,
                        new DateOnly(2026, 4, 17),
                        null,
                        false),
                    [tag.Id],
                    ownerShare),
                boundedMonthly,
                legacyMonthly,
                new Expense(
                    plannerId,
                    "Weekly",
                    300,
                    account.Id,
                    new ExpenseScheduleValue(
                        ExpenseFrequency.Weekly,
                        new DateOnly(2026, 4, 1),
                        null,
                        false),
                    [tag.Id],
                    shared),
                new Expense(
                    plannerId,
                    "Starts in May",
                    5_000,
                    account.Id,
                    new ExpenseScheduleValue(
                        ExpenseFrequency.Monthly,
                        new DateOnly(2026, 5, 1),
                        1,
                        false),
                    [tag.Id],
                    ownerShare),
                new Expense(
                    foreignPlannerId,
                    "Foreign one off",
                    100_000,
                    foreignAccount.Id,
                    new ExpenseScheduleValue(
                        null,
                        new DateOnly(2026, 4, 1),
                        null,
                        false),
                    [foreignTag.Id],
                    [new ContributorShareValue(foreignOwner.Id, 10_000)]),
                new IncomeItem(plannerId, "Salary", 20_000, account.Id, 1, false),
                budget);
            await setup.SaveChangesAsync();
        }

        await using (var aprilContext = new ExpensePlannerDbContext(options))
        {
            var module = Module(aprilContext, plannerId);
            var april = await module.GetExpensesAsync(
                new ExpenseQuery("2026-04", Page: 1, PageSize: 2),
                CancellationToken.None);
            var partnerApril = await module.GetExpensesAsync(
                new ExpenseQuery(
                    "2026-04",
                    ContributorIds: [partner.Id],
                    Page: 1,
                    PageSize: 25),
                CancellationToken.None);

            Assert.Equal(8, april.TotalCount);
            Assert.Equal(2, april.Items.Count);
            Assert.Equal(4_600, april.TotalAmountPence);
            Assert.Equal(5, partnerApril.TotalCount);
            Assert.Equal(750, partnerApril.TotalAmountPence);
            Assert.All(partnerApril.Items, item =>
            {
                Assert.Equal("weekly", item.Frequency);
                Assert.Equal(150, item.AttributedAmountPence);
            });

            var retainedLegacy = await module.SaveExpenseAsync(
                legacyMonthly.Id,
                new SaveExpenseRequest(
                    "Legacy monthly",
                    100,
                    account.Id,
                    "monthly",
                    null,
                    12,
                    false,
                    [tag.Id],
                    [new ContributorShareDto(owner.Id, 10_000)]),
                CancellationToken.None);
            Assert.Null(retainedLegacy.ScheduleAnchorDate);

            await Assert.ThrowsAsync<DomainValidationException>(() =>
                module.SaveExpenseAsync(
                    boundedMonthly.Id,
                    new SaveExpenseRequest(
                        "Monthly",
                        2_000,
                        account.Id,
                        "monthly",
                        null,
                        5,
                        false,
                        [tag.Id],
                        [new ContributorShareDto(owner.Id, 10_000)]),
                    CancellationToken.None));
        }

        await using (var reportContext = new ExpensePlannerDbContext(options))
        {
            var reports = new MonthlyOverviewModule(
                reportContext,
                new FixedPlannerContext(plannerId),
                new NoOpPlannerCache());
            var april = await reports.GetAsync("2026-04", CancellationToken.None);
            var may = await reports.GetAsync("2026-05", CancellationToken.None);

            Assert.Equal("2026-04", april.Month);
            Assert.Equal(4_600, april.ProjectedExpensesPence);
            Assert.Equal(8_300, may.ProjectedExpensesPence);
            Assert.Equal(20_000, april.ProjectedIncomePence);
            Assert.Equal(20_000, may.ProjectedIncomePence);
            Assert.Equal(10_000, Assert.Single(april.BudgetLines).AllowancePence);
            Assert.Equal(4_600, Assert.Single(april.BudgetLines).ProjectedExpensesPence);
            Assert.Equal(8_300, Assert.Single(may.BudgetLines).ProjectedExpensesPence);
        }
    }

    private static bool IntegrationTestsEnabled() =>
        string.Equals(
            Environment.GetEnvironmentVariable("RUN_INTEGRATION_TESTS"),
            "true",
            StringComparison.OrdinalIgnoreCase);

    private static CommitmentsModule Module(
        ExpensePlannerDbContext dbContext,
        Guid plannerId) =>
        new CommitmentsModule(
            dbContext,
            new FixedPlannerContext(plannerId),
            new EmptyWorkingDayCalendar(),
            new NoOpPlannerCache());

    private static ReplaceBudgetRequest BudgetRequest(
        params (string Name, long AllowancePence, Guid TagId,
            (Guid ContributorId, int BasisPoints)[] Shares)[] lines) =>
        new(lines.Select(line => new SaveBudgetLineRequest(
            line.Name,
            line.AllowancePence,
            line.TagId,
            line.Shares.Select(share =>
                new ContributorShareDto(
                    share.ContributorId,
                    share.BasisPoints)).ToArray())).ToArray());

    private static List<TrackedBudgetState> CaptureBudgetStates(
        ExpensePlannerDbContext dbContext)
    {
        var states = new List<TrackedBudgetState>();
        dbContext.SavingChanges += (_, _) =>
        {
            states.AddRange(dbContext.ChangeTracker.Entries()
                .Where(entry =>
                    entry.Entity is BudgetLine or BudgetLineContributorShare)
                .Select(entry => new TrackedBudgetState(
                    entry.Entity.GetType().Name,
                    entry.Entity switch
                    {
                        BudgetLine line => line.Id,
                        BudgetLineContributorShare share => share.BudgetLineId,
                        _ => Guid.Empty,
                    },
                    entry.State)));
        };
        return states;
    }

    private sealed record TrackedBudgetState(
        string EntityType,
        Guid Id,
        EntityState State);

    private sealed class FixedPlannerContext(Guid plannerId) : IPlannerContext
    {
        public Guid PlannerId { get; } = plannerId;

        public Guid UserId { get; } = Guid.NewGuid();
    }

    private sealed class EmptyWorkingDayCalendar : IWorkingDayCalendar
    {
        public Task<IReadOnlySet<DateOnly>> GetHolidaysAsync(
            int fromYear,
            int toYear,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlySet<DateOnly>>(new HashSet<DateOnly>());
    }

    private sealed class NoOpPlannerCache : IPlannerCache
    {
        public Task<T> GetOrCreateAsync<T>(
            Guid plannerId,
            string key,
            TimeSpan lifetime,
            Func<CancellationToken, Task<T>> factory,
            CancellationToken cancellationToken) =>
            factory(cancellationToken);

        public Task InvalidateAsync(
            Guid plannerId,
            CancellationToken cancellationToken) =>
            Task.CompletedTask;
    }

    private sealed class NoPlannerContext : IPlannerContext
    {
        public Guid PlannerId =>
            throw new InvalidOperationException("Registration has no authenticated planner.");

        public Guid UserId =>
            throw new InvalidOperationException("Registration has no authenticated user.");
    }
}
