using ExpensePlanner.Application.Common;
using ExpensePlanner.Domain.Common;
using ExpensePlanner.Infrastructure.Calendars;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace ExpensePlanner.Api;

public sealed class ApiExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    private static readonly Action<ILogger, int, Exception?> RequestFailed =
        LoggerMessage.Define<int>(
            LogLevel.Error,
            new EventId(2001, nameof(RequestFailed)),
            "Request failed with status {StatusCode}");

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (status, title) = exception switch
        {
            DomainValidationException or ArgumentException => (StatusCodes.Status400BadRequest, "Validation failed"),
            ForbiddenException => (StatusCodes.Status403Forbidden, "Request forbidden"),
            NotFoundException => (StatusCodes.Status404NotFound, "Resource not found"),
            ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            CalendarUnavailableException => (StatusCodes.Status503ServiceUnavailable, "Calendar unavailable"),
            _ => (StatusCodes.Status500InternalServerError, "Unexpected error"),
        };
        if (status >= 500)
        {
            RequestFailed(logger, status, exception);
        }

        httpContext.Response.StatusCode = status;
        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails
            {
                Status = status,
                Title = title,
                Detail = status == 500 ? "An unexpected error occurred." : exception.Message,
                Instance = httpContext.Request.Path,
            },
            Exception = exception,
        });
    }
}
