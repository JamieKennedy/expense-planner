using Microsoft.AspNetCore.Identity;

namespace ExpensePlanner.Infrastructure.Persistence;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public Guid PlannerId { get; set; }
    public bool SetupComplete { get; set; }
}

public sealed class RefreshTokenEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid FamilyId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public string? ReplacedByHash { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public DateTimeOffset FamilyExpiresAtUtc { get; set; }
    public DateTimeOffset? RevokedAtUtc { get; set; }
    public ApplicationUser User { get; set; } = null!;
}

public sealed class InvitationEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid InvitedByUserId { get; set; }
    public Guid? UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string CodeHash { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public DateTimeOffset? UsedAtUtc { get; set; }
}

public sealed class SetupTokenEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string CodeHash { get; set; } = string.Empty;
    public string Purpose { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public DateTimeOffset? UsedAtUtc { get; set; }
}
