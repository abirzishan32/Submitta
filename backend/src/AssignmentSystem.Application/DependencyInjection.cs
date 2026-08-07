using System.Reflection;
using AssignmentSystem.Application.Common.Security;
using AssignmentSystem.Application.Features.Admin.Academics;
using AssignmentSystem.Application.Features.Admin.Settings;
using AssignmentSystem.Application.Features.Admin.Users;
using AssignmentSystem.Application.Features.Auth;
using AssignmentSystem.Application.Features.Notifications;
using AssignmentSystem.Application.Features.Editor;
using AssignmentSystem.Application.Features.Teacher.Assignments;
using AssignmentSystem.Application.Features.Student;
using AssignmentSystem.Application.Features.Teacher.Grading;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace AssignmentSystem.Application;

/// <summary>
/// Composition root for the Application layer. Keeping registration next to the
/// layer it belongs to stops Program.cs from turning into a 300-line manifest.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Picks up every IValidator<T> in this assembly, so adding a validator
        // needs no corresponding registration line.
        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly(), includeInternalTypes: true);

        services.AddScoped<IAccessControl, AccessControl>();
        services.AddScoped<IAuthService, AuthService>();

        // Admin module
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IClassService, ClassService>();
        services.AddScoped<ISubjectService, SubjectService>();
        services.AddScoped<IOfferingService, OfferingService>();
        services.AddScoped<IEnrollmentService, EnrollmentService>();
        services.AddScoped<ISettingService, SettingService>();

        // Teacher module
        services.AddScoped<IAssignmentService, AssignmentService>();
        services.AddScoped<IAttachmentService, AttachmentService>();
        services.AddScoped<IGradingService, GradingService>();

        // Student module
        services.AddScoped<IStudentService, StudentService>();

        // Rich editor: operation log, replay and version history
        services.AddScoped<IEditorService, EditorService>();

        // Notifications: the service writes and reads them, the audience works
        // out who hears about what, and the dispatcher turns a domain event
        // into both.
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<INotificationAudience, NotificationAudience>();
        services.AddScoped<INotificationDispatcher, NotificationDispatcher>();

        return services;
    }
}
