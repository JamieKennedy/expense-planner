namespace ExpensePlanner.Domain.Common;

public sealed class DomainValidationException(string message) : Exception(message);
