using ExpensePlanner.Application.Abstractions;
using ExpensePlanner.Domain.Planning;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace ExpensePlanner.Infrastructure.Persistence;

public sealed class ExpensePlannerDbContext(
    DbContextOptions<ExpensePlannerDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options), IExpensePlannerDbContext
{
    public DbSet<Planner> Planners => Set<Planner>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Contributor> Contributors => Set<Contributor>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<IncomeItem> IncomeItems => Set<IncomeItem>();
    public DbSet<BudgetTemplate> BudgetTemplates => Set<BudgetTemplate>();
    public DbSet<BudgetLine> BudgetLines => Set<BudgetLine>();
    public DbSet<BankHoliday> BankHolidays => Set<BankHoliday>();
    public DbSet<RefreshTokenEntity> RefreshTokens => Set<RefreshTokenEntity>();
    public DbSet<InvitationEntity> Invitations => Set<InvitationEntity>();
    public DbSet<SetupTokenEntity> SetupTokens => Set<SetupTokenEntity>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<ApplicationUser>(entity =>
        {
            entity.HasIndex(user => user.PlannerId);
            entity.Property(user => user.SetupComplete).HasDefaultValue(false);
        });

        builder.Entity<Planner>(entity =>
        {
            entity.ToTable("Planners");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Name).HasMaxLength(120);
        });

        ConfigureReference(builder.Entity<Account>(), "Accounts");
        ConfigureReference(builder.Entity<Contributor>(), "Contributors");
        ConfigureReference(builder.Entity<Tag>(), "Tags");
        builder.Entity<Tag>().Property(item => item.Colour).HasMaxLength(7);

        builder.Entity<Expense>(entity =>
        {
            entity.ToTable("Expenses");
            ConfigurePlannerOwned(entity);
            entity.Property(item => item.Name).HasMaxLength(160);
            entity.Property(item => item.AmountPence);
            entity.HasOne<Account>()
                .WithMany()
                .HasForeignKey(item => item.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(item => item.Tags)
                .WithOne()
                .HasForeignKey(item => item.ExpenseId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(item => item.ContributorShares)
                .WithOne()
                .HasForeignKey(item => item.ExpenseId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(item => item.Tags).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.Navigation(item => item.ContributorShares).UsePropertyAccessMode(PropertyAccessMode.Field);
        });

        builder.Entity<ExpenseTag>(entity =>
        {
            entity.ToTable("ExpenseTags");
            entity.HasKey(item => new { item.ExpenseId, item.TagId });
            entity.HasOne<Tag>().WithMany().HasForeignKey(item => item.TagId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<ExpenseContributorShare>(entity =>
        {
            entity.ToTable("ExpenseContributorShares");
            entity.HasKey(item => new { item.ExpenseId, item.ContributorId });
            entity.HasOne<Contributor>()
                .WithMany()
                .HasForeignKey(item => item.ContributorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<IncomeItem>(entity =>
        {
            entity.ToTable("IncomeItems");
            ConfigurePlannerOwned(entity);
            entity.Property(item => item.Name).HasMaxLength(160);
            entity.HasOne<Account>()
                .WithMany()
                .HasForeignKey(item => item.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<BudgetTemplate>(entity =>
        {
            entity.ToTable("BudgetTemplates");
            ConfigurePlannerOwned(entity);
            entity.HasIndex(item => item.PlannerId).IsUnique();
            entity.HasMany(item => item.Lines)
                .WithOne()
                .HasForeignKey(item => item.BudgetTemplateId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(item => item.Lines).UsePropertyAccessMode(PropertyAccessMode.Field);
        });

        builder.Entity<BudgetLine>(entity =>
        {
            entity.ToTable("BudgetLines");
            ConfigurePlannerOwned(entity);
            entity.Property(item => item.Name).HasMaxLength(160);
            entity.HasIndex(item => new { item.BudgetTemplateId, item.TagId }).IsUnique();
            entity.HasOne<Tag>().WithMany().HasForeignKey(item => item.TagId).OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(item => item.ContributorShares)
                .WithOne()
                .HasForeignKey(item => item.BudgetLineId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(item => item.ContributorShares).UsePropertyAccessMode(PropertyAccessMode.Field);
        });

        builder.Entity<BudgetLineContributorShare>(entity =>
        {
            entity.ToTable("BudgetLineContributorShares");
            entity.HasKey(item => new { item.BudgetLineId, item.ContributorId });
            entity.HasOne<Contributor>()
                .WithMany()
                .HasForeignKey(item => item.ContributorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<BankHoliday>(entity =>
        {
            entity.ToTable("BankHolidays");
            entity.HasKey(item => item.Date);
            entity.Property(item => item.Title).HasMaxLength(160);
        });

        builder.Entity<RefreshTokenEntity>(entity =>
        {
            entity.ToTable("RefreshTokens");
            entity.HasKey(item => item.Id);
            entity.HasIndex(item => item.TokenHash).IsUnique();
            entity.HasIndex(item => new { item.UserId, item.FamilyId });
            entity.Property(item => item.TokenHash).HasMaxLength(64);
            entity.Property(item => item.ReplacedByHash).HasMaxLength(64);
            entity.HasOne(item => item.User)
                .WithMany()
                .HasForeignKey(item => item.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<InvitationEntity>(entity =>
        {
            entity.ToTable("Invitations");
            entity.HasKey(item => item.Id);
            entity.HasIndex(item => item.CodeHash).IsUnique();
            entity.Property(item => item.Email).HasMaxLength(256);
            entity.Property(item => item.CodeHash).HasMaxLength(64);
        });

        builder.Entity<SetupTokenEntity>(entity =>
        {
            entity.ToTable("SetupTokens");
            entity.HasKey(item => item.Id);
            entity.HasIndex(item => item.CodeHash).IsUnique();
            entity.Property(item => item.CodeHash).HasMaxLength(64);
            entity.Property(item => item.Purpose).HasMaxLength(32);
        });
    }

    private static void ConfigureReference<T>(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<T> entity, string table)
        where T : ReferenceData
    {
        entity.ToTable(table);
        ConfigurePlannerOwned(entity);
        entity.Property(item => item.Name).HasMaxLength(120);
        entity.HasIndex(item => new { item.PlannerId, item.Name })
            .IsUnique()
            .HasFilter("\"IsArchived\" = FALSE");
    }

    private static void ConfigurePlannerOwned<T>(
        Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<T> entity)
        where T : PlannerOwnedEntity
    {
        entity.HasKey(item => item.Id);
        entity.HasIndex(item => item.PlannerId);
    }
}
