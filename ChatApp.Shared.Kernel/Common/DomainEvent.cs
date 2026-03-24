namespace ChatApp.Shared.Kernel.Common
{
    public abstract record DomainEvent
    {
        public Guid EventId { get; }
        public DateTime OccurredAtUtc { get; }

        protected DomainEvent()
        {
            EventId= Guid.NewGuid();
            OccurredAtUtc= DateTime.UtcNow;
        }
    }
}