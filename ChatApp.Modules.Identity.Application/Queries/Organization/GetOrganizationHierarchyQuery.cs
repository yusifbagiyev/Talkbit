using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Queries.Organization
{
    /// <summary>
    /// Təşkilat iyerarxiyası — company scoped.
    /// SuperAdmin hər hansı CompanyId göndərə bilər. Admin/User yalnız öz şirkətini görür.
    /// </summary>
    public record GetOrganizationHierarchyQuery(
        Guid? CompanyId = null,
        bool IsSuperAdmin = false
    ) : IRequest<Result<List<OrganizationHierarchyNodeDto>>>;

    public class GetOrganizationHierarchyQueryHandler(
        IUnitOfWork unitOfWork,
        ILogger<GetOrganizationHierarchyQueryHandler> logger)
        : IRequestHandler<GetOrganizationHierarchyQuery, Result<List<OrganizationHierarchyNodeDto>>>
    {
        public async Task<Result<List<OrganizationHierarchyNodeDto>>> Handle(
            GetOrganizationHierarchyQuery query,
            CancellationToken cancellationToken)
        {
            try
            {
                // Company scoping
                var companiesQuery = unitOfWork.Companies
                    .Include(c => c.HeadOfCompany)
                    .AsNoTracking()
                    .AsQueryable();

                var departmentsQuery = unitOfWork.Departments
                    .Include(d => d.ParentDepartment)
                    .Include(d => d.HeadOfDepartment)
                    .AsNoTracking()
                    .AsQueryable();

                // SuperAdmin: bütün şirkətləri və ya spesifik bir şirkəti görür
                // Admin/User: yalnız öz şirkətini
                if (query.CompanyId.HasValue)
                {
                    companiesQuery = companiesQuery.Where(c => c.Id == query.CompanyId.Value);
                    departmentsQuery = departmentsQuery.Where(d => d.CompanyId == query.CompanyId.Value);
                }

                var companies = await companiesQuery.ToListAsync(cancellationToken);

                var departments = await departmentsQuery.ToListAsync(cancellationToken);

                // Get users with company scoping
                var usersQuery = unitOfWork.Users
                    .Include(u => u.Employee)
                        .ThenInclude(e => e!.Position)
                    .AsNoTracking()
                    .AsQueryable();

                if (query.CompanyId.HasValue)
                    usersQuery = usersQuery.Where(u => u.CompanyId == query.CompanyId.Value);

                var users = await usersQuery.ToListAsync(cancellationToken);

                // Count users per department
                var departmentUserCounts = users
                    .Where(u => u.Employee != null && u.Employee.DepartmentId.HasValue)
                    .GroupBy(u => u.Employee!.DepartmentId!.Value)
                    .ToDictionary(g => g.Key, g => g.Count());

                // Build department nodes
                var departmentNodes = departments.Select(d => new OrganizationHierarchyNodeDto(
                    Type: NodeType.Department,
                    Id: d.Id,
                    Name: d.Name,
                    Level: 0,
                    ParentDepartmentId: d.ParentDepartmentId,
                    HeadOfDepartmentName: d.HeadOfDepartment?.FullName,
                    HeadOfDepartmentId: d.HeadOfDepartmentId,
                    UserCount: departmentUserCounts.GetValueOrDefault(d.Id, 0),
                    Email: null,
                    Role: null,
                    IsActive: true,
                    AvatarUrl: null,
                    PositionName: null,
                    DepartmentId: null,
                    CreatedAtUtc: d.CreatedAtUtc,
                    Children: new List<OrganizationHierarchyNodeDto>()
                )).ToList();

                // Build user nodes
                var userNodes = users.Select(u => new OrganizationHierarchyNodeDto(
                    Type: NodeType.User,
                    Id: u.Id,
                    Name: u.FullName,
                    Level: 0,
                    ParentDepartmentId: null,
                    HeadOfDepartmentName: null,
                    HeadOfDepartmentId: null,
                    UserCount: 0,
                    Email: u.Email,
                    Role: u.Role.ToString(),
                    IsActive: u.IsActive,
                    AvatarUrl: u.AvatarUrl,
                    PositionName: u.Employee?.Position?.Name,
                    DepartmentId: u.Employee?.DepartmentId,
                    CreatedAtUtc: u.CreatedAtUtc,
                    Children: new List<OrganizationHierarchyNodeDto>()
                )).ToList();

                // Build hierarchy: Company → Departments → Sub-departments → Users
                var result = BuildHierarchy(companies, departments, departmentNodes, userNodes);

                return Result.Success(result);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error retrieving organization hierarchy");
                return Result.Failure<List<OrganizationHierarchyNodeDto>>(
                    "An error occurred while retrieving organization hierarchy");
            }
        }

        private List<OrganizationHierarchyNodeDto> BuildHierarchy(
            List<Domain.Entities.Company> companies,
            List<Domain.Entities.Department> departmentEntities,
            List<OrganizationHierarchyNodeDto> departmentNodes,
            List<OrganizationHierarchyNodeDto> userNodes)
        {
            // Build lookup: departmentId -> head name
            var deptHeadNames = departmentNodes
                .Where(d => d.HeadOfDepartmentId.HasValue && d.HeadOfDepartmentName != null)
                .ToDictionary(d => d.Id, d => d.HeadOfDepartmentName!);

            // Group users by department
            var usersByDepartment = userNodes
                .Where(u => u.DepartmentId.HasValue)
                .GroupBy(u => u.DepartmentId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            // Group departments by companyId
            var departmentsByCompany = departmentEntities
                .GroupBy(d => d.CompanyId)
                .ToDictionary(g => g.Key, g => g.Select(d => d.Id).ToHashSet());

            // Group child departments by parent
            var childDepartmentsByParent = departmentNodes
                .Where(d => d.ParentDepartmentId.HasValue)
                .GroupBy(d => d.ParentDepartmentId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            var result = new List<OrganizationHierarchyNodeDto>();

            foreach (var company in companies)
            {
                var companyHeadName = company.HeadOfCompany?.FullName;

                // Get root departments for this company (no parent), sorted A-Z
                var companyDeptIds = departmentsByCompany.GetValueOrDefault(company.Id) ?? [];
                var rootDepts = departmentNodes
                    .Where(d => companyDeptIds.Contains(d.Id) && !d.ParentDepartmentId.HasValue)
                    .OrderBy(d => d.Name)
                    .ToList();

                // Build department tree under this company
                var companyChildren = new List<OrganizationHierarchyNodeDto>();
                foreach (var rootDept in rootDepts)
                {
                    var subordinateCount = CalculateSubordinateCount(rootDept, usersByDepartment);
                    var deptWithInfo = rootDept with
                    {
                        SupervisorName = companyHeadName,
                        SubordinateCount = subordinateCount
                    };
                    companyChildren.Add(BuildDepartmentNode(deptWithInfo, 1,
                        childDepartmentsByParent, usersByDepartment, deptHeadNames));
                }

                var companyNode = new OrganizationHierarchyNodeDto(
                    Type: NodeType.Company,
                    Id: company.Id,
                    Name: company.Name,
                    Level: 0,
                    ParentDepartmentId: null,
                    HeadOfDepartmentName: companyHeadName,
                    HeadOfDepartmentId: company.HeadOfCompanyId,
                    UserCount: 0,
                    Email: null,
                    Role: null,
                    IsActive: true,
                    AvatarUrl: null,
                    PositionName: null,
                    DepartmentId: null,
                    CreatedAtUtc: company.CreatedAtUtc,
                    Children: companyChildren,
                    SubordinateCount: 0
                );

                result.Add(companyNode);
            }

            // Add users with no department to root
            var usersWithoutDepartment = userNodes
                .Where(u => !u.DepartmentId.HasValue)
                .Select(u => u with { Level = 0 })
                .ToList();
            result.AddRange(usersWithoutDepartment);

            return result;
        }

        private static OrganizationHierarchyNodeDto BuildDepartmentNode(
            OrganizationHierarchyNodeDto dept,
            int level,
            Dictionary<Guid, List<OrganizationHierarchyNodeDto>> childDepartmentsByParent,
            Dictionary<Guid, List<OrganizationHierarchyNodeDto>> usersByDepartment,
            Dictionary<Guid, string> deptHeadNames)
        {
            var children = new List<OrganizationHierarchyNodeDto>();

            // This dept's head name (for assigning as supervisor to children)
            deptHeadNames.TryGetValue(dept.Id, out var thisDeptHeadName);

            // 1. First: Add department head (if exists and is in this department)
            if (usersByDepartment.TryGetValue(dept.Id, out var users))
            {
                var headUser = users.FirstOrDefault(u => u.Id == dept.HeadOfDepartmentId);
                if (headUser != null)
                {
                    children.Add(headUser with
                    {
                        Level = level + 1,
                        SupervisorName = dept.SupervisorName,
                        IsDepartmentHead = true
                    });
                }
            }

            // 2. Then: Add child departments (sorted A-Z)
            if (childDepartmentsByParent.TryGetValue(dept.Id, out var childDepts))
            {
                foreach (var child in childDepts.OrderBy(d => d.Name))
                {
                    var subordinateCount = CalculateSubordinateCount(child, usersByDepartment);
                    var childWithInfo = child with
                    {
                        SupervisorName = thisDeptHeadName,
                        SubordinateCount = subordinateCount
                    };
                    children.Add(BuildDepartmentNode(childWithInfo, level + 1,
                        childDepartmentsByParent, usersByDepartment, deptHeadNames));
                }
            }

            // 3. Finally: Add remaining users (not dept head, sorted A-Z)
            if (users != null)
            {
                foreach (var user in users.Where(u => u.Id != dept.HeadOfDepartmentId).OrderBy(u => u.Name))
                {
                    children.Add(user with
                    {
                        Level = level + 1,
                        SupervisorName = thisDeptHeadName,
                        IsDepartmentHead = false
                    });
                }
            }

            return dept with { Level = level, Children = children };
        }

        private static int CalculateSubordinateCount(
            OrganizationHierarchyNodeDto dept,
            Dictionary<Guid, List<OrganizationHierarchyNodeDto>> usersByDepartment)
        {
            if (!usersByDepartment.TryGetValue(dept.Id, out var users)) return 0;
            // Count direct employees excluding the department head
            return users.Count(u => u.Id != dept.HeadOfDepartmentId);
        }
    }
}
