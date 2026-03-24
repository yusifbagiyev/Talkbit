# SignalR Development

## Purpose
Build and maintain real-time messaging features using SignalR hubs.

## Serves Goals
- API reliability
- Performance

## Inputs
- Feature requirement from product-owner
- Existing SignalR hubs: `/hubs/chat`, `/hubs/notifications`, `/hubs/presence`
- `MEMORY.md` (real-time patterns)
- `ChatApp.Shared.Infrastructure` (ConnectionManager, PresenceService)

## Process
1. Determine if existing hub can be extended or new hub is needed
2. Define events: server-to-client and client-to-server
3. Implement hub methods
4. Use `ConnectionManager` for connection tracking
5. Use `PresenceService` for online/offline status
6. Use `ChannelMemberCache` for channel-scoped broadcasts
7. Handle reconnection scenarios
8. Document event contract for frontend-developer
9. Configure keep-alive (15s), timeout (30s), max message size (1MB)

## Outputs
- Hub implementation in codebase
- `outputs/YYYY-MM-DD_signalr_[feature].md` (event contracts)
- Journal entry with events defined

## Quality Bar
- Events follow existing naming pattern
- Reconnection handled gracefully
- No messages >1MB
- Connection management uses existing infrastructure services
- Auth token passed via query string for WebSocket handshake

## Adding a New SignalR Broadcast (Established Pattern)

When a new server→client event is needed, follow these 6 steps:

```
1. Domain/Events/XxxEvent.cs              — DomainEvent record
2. Application/Events/XxxEventHandler.cs  — inject ISignalRNotificationService + IChannelMemberCache
3. ISignalRNotificationService            — add method signature
4. SignalRNotificationService             — implement (CollectMemberConnectionsAsync + SendAsync)
5. Infrastructure/DependencyInjection.cs  — services.AddScoped<XxxEventHandler>()
6. ChatApp.Api/Program.cs                 — add eventBus.Subscribe<XxxEvent>() block
```

**Injecting IEventBus into a Command Handler** — publish after SaveChangesAsync:
```csharp
await _unitOfWork.SaveChangesAsync(cancellationToken);
await _eventBus.PublishAsync(new XxxEvent(channelId, channel.Name, channel.AvatarUrl), cancellationToken);
```

**Event payload** — send as anonymous object:
```csharp
await _hubContext.Clients.Clients(allConnections)
    .SendAsync("ChannelUpdated", new { channelId, name, avatarUrl });
```

**ChannelMemberCache**: Use `IChannelMemberCache.GetChannelMemberIdsAsync(channelId)` in handlers — fetches member IDs from in-memory cache, not DB. Always prefer this over `UnitOfWork.ChannelMembers` in event handlers.
