using ChatApp.Modules.Channels.Application.Behaviors;
using ChatApp.Modules.Channels.Application.Commands.Channels;
using ChatApp.Modules.Channels.Application.Events;
using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Infrastructure.Persistence;
using ChatApp.Modules.Channels.Infrastructure.Persistence.Repositories;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ChatApp.Modules.Channels.Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddChannelsInfrastructure(
            this IServiceCollection services,
            IConfiguration configuration)
        {
            // Database - Use same connection string as Identity module
            var connectionString = configuration.GetConnectionString("IdentityDb")
                ?? throw new InvalidOperationException("Database connection string not configured");

            services.AddDbContext<ChannelsDbContext>(options =>
                options.UseNpgsql(connectionString, npgsqlOptions =>
                {
                    npgsqlOptions.MigrationsAssembly(typeof(ChannelsDbContext).Assembly.FullName);
                    npgsqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
                }));

            // Repositories
            services.AddScoped<IUnitOfWork, UnitOfWork>();
            services.AddScoped<IChannelRepository, ChannelRepository>();
            services.AddScoped<IChannelMemberRepository, ChannelMemberRepository>();
            services.AddScoped<IChannelMessageRepository, ChannelMessageRepository>();

            return services;
        }

        public static IServiceCollection AddChannelsApplication(
            this IServiceCollection services)
        {
            // Register MediatR for CQRS pattern
            services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(
                typeof(CreateChannelCommand).Assembly));

            // Register FluentValidation
            services.AddValidatorsFromAssembly(
                typeof(CreateChannelCommand).Assembly);

            // Add validation behavior to MediatR pipeline
            services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

            // Register event handlers
            services.AddScoped<MemberRemovedEventHandler>();
            services.AddScoped<ChannelUpdatedEventHandler>();

            return services;
        }
    }
}