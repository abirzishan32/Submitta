using FluentValidation;
using Microsoft.AspNetCore.Mvc.Filters;

namespace AssignmentSystem.Api.Filters;

/// <summary>
/// Runs any registered FluentValidation validator against each action argument
/// before the action executes.
///
/// Applied globally, so adding a validator is enough to enforce it — no
/// controller has to remember to call it, and none can forget.
/// </summary>
public sealed class ValidationFilter(IServiceProvider serviceProvider) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(
        ActionExecutingContext context,
        ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is null)
            {
                continue;
            }

            var validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());

            if (serviceProvider.GetService(validatorType) is not IValidator validator)
            {
                continue;
            }

            var result = await validator.ValidateAsync(
                new ValidationContext<object>(argument),
                context.HttpContext.RequestAborted);

            if (!result.IsValid)
            {
                // Thrown rather than short-circuited, so the exception middleware
                // renders it in the same envelope as every other failure.
                throw new ValidationException(result.Errors);
            }
        }

        await next();
    }
}
