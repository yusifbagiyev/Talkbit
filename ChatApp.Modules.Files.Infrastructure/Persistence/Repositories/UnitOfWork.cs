using ChatApp.Modules.Files.Application.Interfaces;
using Microsoft.EntityFrameworkCore.Storage;

namespace ChatApp.Modules.Files.Infrastructure.Persistence.Repositories
{
    public class UnitOfWork:IUnitOfWork
    {
        private readonly FilesDbContext _context;
        private IDbContextTransaction? _transaction;

        public IFileRepository Files { get; }
        public IDriveFolderRepository DriveFolders { get; }
        public UnitOfWork(FilesDbContext context)
        {
            _context = context;
            Files = new FileRepository(context);
            DriveFolders = new DriveFolderRepository(context);
        }

        public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return await _context.SaveChangesAsync(cancellationToken);
        }


        public async Task BeginTransactionAsync(CancellationToken cancellationToken = default)
        {
            _transaction= await _context.Database.BeginTransactionAsync(cancellationToken);
        }


        public async Task CommitTransactionAsync(CancellationToken cancellationToken = default)
        {
            if (_transaction != null)
            {
                await _transaction.CommitAsync(cancellationToken);
                await _transaction.DisposeAsync();
                _transaction = null;
            }
        }


        public async Task RollbackTransactionAsync(CancellationToken cancellationToken = default)
        {
            if(_transaction != null)
            {
                await _transaction.RollbackAsync(cancellationToken);
                await _transaction.DisposeAsync();
                _transaction = null;
            }
        }


        public void Dispose()
        {
            _transaction?.Dispose();
            _transaction = null;
        }
    }
}