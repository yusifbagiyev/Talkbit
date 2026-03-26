using ChatApp.Modules.Identity.Domain.Entities;
using ChatApp.Modules.Identity.Domain.Enums;
using ChatApp.Modules.Identity.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Infrastructure.Persistence
{
    /// <summary>
    /// Handles seeding of initial data into the database
    /// This runs automatically when the application starts if the database is empty
    /// </summary>
    public static class IdentityDatabaseSeeder
    {
        /// <summary>
        /// Seeds the database with initial data if it's empty
        /// This is idempotent - it checks before adding data so it's safe to run multiple times
        /// </summary>
        public static async Task SeedAsync(IdentityDbContext context, IPasswordHasher passwordHasher, ILogger logger)
        {
            try
            {
                // Check if we need to seed by looking for existing users
                var hasUsers = await context.Users.AnyAsync();

                if (hasUsers)
                {
                    logger.LogInformation("Database already contains data. Skipping seed operation");
                    return;
                }

                logger.LogInformation("Database is empty. Beginning seed operation...");

                // Start a transaction to ensure all-or-nothing seeding
                await using var transaction = await context.Database.BeginTransactionAsync();

                try
                {
                    // Step 1: Seed company first
                    var company = await SeedCompanyAsync(context, logger);
                    await context.SaveChangesAsync();

                    // Step 2: Seed departments
                    var departments = await SeedDepartmentsAsync(context, company, logger);
                    await context.SaveChangesAsync();

                    // Step 3: Seed positions (needs departments)
                    var positions = await SeedPositionsAsync(context, departments, logger);
                    await context.SaveChangesAsync();

                    // Step 4: Seed users and employees (includes Head of Company)
                    await SeedDefaultUsersAsync(context, passwordHasher, company, departments, positions, logger);
                    await context.SaveChangesAsync();

                    // Step 5: Assign supervisors (all employees now exist in DB)
                    await AssignSupervisorsAsync(context, logger);
                    await context.SaveChangesAsync();

                    // Commit the transaction - everything succeeded
                    await transaction.CommitAsync();

                    logger.LogInformation("Database seeding completed successfully");
                }
                catch (Exception ex)
                {
                    // Something went wrong - rollback the transaction
                    logger.LogError(ex, "Error during database seeding. Rolling back transaction");
                    await transaction.RollbackAsync();
                    throw;
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to seed database");
                throw;
            }
        }

        /// <summary>
        /// Creates the default company
        /// </summary>
        private static async Task<Company> SeedCompanyAsync(
            IdentityDbContext context,
            ILogger logger)
        {
            if (await context.Companies.AnyAsync())
            {
                logger?.LogInformation("Companies already exist, skipping company seeding");
                return await context.Companies.FirstAsync();
            }

            logger?.LogInformation("Seeding default company...");

            var company = new Company("166 Logistics") { Id = Guid.Parse("20000000-0000-0000-0000-000000000001") };
            await context.Companies.AddAsync(company);

            logger?.LogInformation("Seeded company: 166 Logistics");

            return company;
        }

        /// <summary>
        /// Creates the default departments
        /// </summary>
        private static async Task<Dictionary<string, Department>> SeedDepartmentsAsync(
            IdentityDbContext context,
            Company company,
            ILogger logger)
        {
            if (await context.Departments.AnyAsync())
            {
                logger?.LogInformation("Departments already exist, skipping department seeding");
                return new Dictionary<string, Department>();
            }

            logger?.LogInformation("Seeding default departments...");

            // Create parent departments first
            var departments = new Dictionary<string, Department>
            {
                ["Engineering"] = new Department("Engineering", company.Id),
                ["Sales & Marketing"] = new Department("Sales & Marketing", company.Id),
                ["Finance"] = new Department("Finance", company.Id),
                ["HR"] = new Department("HR", company.Id)
            };

            foreach (var dept in departments.Values)
            {
                await context.Departments.AddAsync(dept);
            }

            // Save parent departments to get their IDs
            await context.SaveChangesAsync();

            // Create subdepartments
            var engineeringDept = departments["Engineering"];
            var salesMarketingDept = departments["Sales & Marketing"];
            var financeDeptParent = departments["Finance"];
            var hrDeptParent = departments["HR"];

            var subDepartments = new Dictionary<string, Department>
            {
                ["Frontend Development"] = new Department("Frontend Development", company.Id, engineeringDept.Id),
                ["Backend Development"] = new Department("Backend Development", company.Id, engineeringDept.Id),
                ["QA & Testing"] = new Department("QA & Testing", company.Id, engineeringDept.Id),
                ["DevOps"] = new Department("DevOps", company.Id, engineeringDept.Id),
                ["IT Support"] = new Department("IT Support", company.Id, engineeringDept.Id),
                ["Sales"] = new Department("Sales", company.Id, salesMarketingDept.Id),
                ["Marketing"] = new Department("Marketing", company.Id, salesMarketingDept.Id),
                ["Accounting"] = new Department("Accounting", company.Id, financeDeptParent.Id),
                ["Recruitment"] = new Department("Recruitment", company.Id, hrDeptParent.Id),
            };

            // Add two more top-level departments
            departments["Legal"] = new Department("Legal", company.Id);
            departments["Operations"] = new Department("Operations", company.Id);
            await context.Departments.AddAsync(departments["Legal"]);
            await context.Departments.AddAsync(departments["Operations"]);

            foreach (var subDept in subDepartments.Values)
            {
                await context.Departments.AddAsync(subDept);
                departments[subDept.Name] = subDept;
            }

            logger?.LogInformation("Seeded {Count} departments (with subdepartments):", departments.Count);

            return departments;
        }

        /// <summary>
        /// Creates the default positions
        /// </summary>
        private static async Task<Dictionary<string, Position>> SeedPositionsAsync(
            IdentityDbContext context,
            Dictionary<string, Department> departments,
            ILogger logger)
        {
            if (await context.Positions.AnyAsync())
            {
                logger?.LogInformation("Positions already exist, skipping position seeding");
                return [];
            }

            logger?.LogInformation("Seeding default positions...");

            var frontendDept = departments.TryGetValue("Frontend Development", out var frontDept)
                ? frontDept
                : context.Departments.Local.FirstOrDefault(d => d.Name == "Frontend Development")
                  ?? await context.Departments.FirstOrDefaultAsync(d => d.Name == "Frontend Development");

            var backendDept = departments.TryGetValue("Backend Development", out var backDept)
                ? backDept
                : context.Departments.Local.FirstOrDefault(d => d.Name == "Backend Development")
                  ?? await context.Departments.FirstOrDefaultAsync(d => d.Name == "Backend Development");

            var salesDept = departments.TryGetValue("Sales", out var salesD)
                ? salesD
                : context.Departments.Local.FirstOrDefault(d => d.Name == "Sales")
                  ?? await context.Departments.FirstOrDefaultAsync(d => d.Name == "Sales");

            var financeDept = departments.TryGetValue("Finance", out var finDept)
                ? finDept
                : context.Departments.Local.FirstOrDefault(d => d.Name == "Finance")
                  ?? await context.Departments.FirstOrDefaultAsync(d => d.Name == "Finance");

            var hrDept = departments.TryGetValue("HR", out var hrD)
                ? hrD
                : context.Departments.Local.FirstOrDefault(d => d.Name == "HR")
                  ?? await context.Departments.FirstOrDefaultAsync(d => d.Name == "HR");

            // Look up new departments
            var qaDept = departments.TryGetValue("QA & Testing", out var qaD)
                ? qaD
                : context.Departments.Local.FirstOrDefault(d => d.Name == "QA & Testing")
                  ?? await context.Departments.FirstOrDefaultAsync(d => d.Name == "QA & Testing");

            var devopsDept = departments.TryGetValue("DevOps", out var devD)
                ? devD
                : context.Departments.Local.FirstOrDefault(d => d.Name == "DevOps")
                  ?? await context.Departments.FirstOrDefaultAsync(d => d.Name == "DevOps");

            var itSupportDept = departments.TryGetValue("IT Support", out var itD)
                ? itD
                : context.Departments.Local.FirstOrDefault(d => d.Name == "IT Support")
                  ?? await context.Departments.FirstOrDefaultAsync(d => d.Name == "IT Support");

            var marketingDept = departments.TryGetValue("Marketing", out var mktD)
                ? mktD
                : context.Departments.Local.FirstOrDefault(d => d.Name == "Marketing")
                  ?? await context.Departments.FirstOrDefaultAsync(d => d.Name == "Marketing");

            var accountingDept = departments.TryGetValue("Accounting", out var accD)
                ? accD
                : context.Departments.Local.FirstOrDefault(d => d.Name == "Accounting")
                  ?? await context.Departments.FirstOrDefaultAsync(d => d.Name == "Accounting");

            var recruitmentDept = departments.TryGetValue("Recruitment", out var recD)
                ? recD
                : context.Departments.Local.FirstOrDefault(d => d.Name == "Recruitment")
                  ?? await context.Departments.FirstOrDefaultAsync(d => d.Name == "Recruitment");

            var legalDept = departments.TryGetValue("Legal", out var legD)
                ? legD
                : context.Departments.Local.FirstOrDefault(d => d.Name == "Legal")
                  ?? await context.Departments.FirstOrDefaultAsync(d => d.Name == "Legal");

            var operationsDept = departments.TryGetValue("Operations", out var opsD)
                ? opsD
                : context.Departments.Local.FirstOrDefault(d => d.Name == "Operations")
                  ?? await context.Departments.FirstOrDefaultAsync(d => d.Name == "Operations");

            var positions = new Dictionary<string, Position>
            {
                // Existing
                ["Frontend Developer"] = new Position("Frontend Developer", frontendDept?.Id, "Develops user-facing web applications"),
                ["Senior Frontend Developer"] = new Position("Senior Frontend Developer", frontendDept?.Id, "Lead frontend developer"),
                ["Backend Developer"] = new Position("Backend Developer", backendDept?.Id, "Develops server-side applications"),
                ["Senior Backend Developer"] = new Position("Senior Backend Developer", backendDept?.Id, "Lead backend developer"),
                ["Sales Manager"] = new Position("Sales Manager", salesDept?.Id, "Manages sales team and strategy"),
                ["Sales Representative"] = new Position("Sales Representative", salesDept?.Id, "Handles client relationships and sales"),
                ["Financial Analyst"] = new Position("Financial Analyst", financeDept?.Id, "Analyzes financial data and reports"),
                ["Chief Financial Officer"] = new Position("Chief Financial Officer", financeDept?.Id, "Oversees all financial operations"),
                ["HR Manager"] = new Position("HR Manager", hrDept?.Id, "Manages human resources department"),
                ["HR Specialist"] = new Position("HR Specialist", hrDept?.Id, "Handles recruitment and employee relations"),
                // New positions
                ["QA Engineer"] = new Position("QA Engineer", qaDept?.Id, "Tests and ensures software quality"),
                ["Senior QA Engineer"] = new Position("Senior QA Engineer", qaDept?.Id, "Leads QA team and testing strategy"),
                ["DevOps Engineer"] = new Position("DevOps Engineer", devopsDept?.Id, "Manages CI/CD and infrastructure"),
                ["Senior DevOps Engineer"] = new Position("Senior DevOps Engineer", devopsDept?.Id, "Leads DevOps practices and cloud architecture"),
                ["IT Support Specialist"] = new Position("IT Support Specialist", itSupportDept?.Id, "Provides technical support to employees"),
                ["IT Support Lead"] = new Position("IT Support Lead", itSupportDept?.Id, "Leads IT support team"),
                ["Marketing Specialist"] = new Position("Marketing Specialist", marketingDept?.Id, "Develops marketing campaigns"),
                ["Marketing Manager"] = new Position("Marketing Manager", marketingDept?.Id, "Leads marketing strategy"),
                ["Content Writer"] = new Position("Content Writer", marketingDept?.Id, "Creates marketing content"),
                ["Accountant"] = new Position("Accountant", accountingDept?.Id, "Manages financial records"),
                ["Senior Accountant"] = new Position("Senior Accountant", accountingDept?.Id, "Oversees accounting operations"),
                ["Recruiter"] = new Position("Recruiter", recruitmentDept?.Id, "Handles talent acquisition"),
                ["Senior Recruiter"] = new Position("Senior Recruiter", recruitmentDept?.Id, "Leads recruitment strategy"),
                ["Legal Counsel"] = new Position("Legal Counsel", legalDept?.Id, "Provides legal advice"),
                ["Legal Assistant"] = new Position("Legal Assistant", legalDept?.Id, "Supports legal operations"),
                ["Operations Manager"] = new Position("Operations Manager", operationsDept?.Id, "Manages daily operations"),
                ["Operations Coordinator"] = new Position("Operations Coordinator", operationsDept?.Id, "Coordinates operational activities"),
                ["Junior Frontend Developer"] = new Position("Junior Frontend Developer", frontendDept?.Id, "Entry-level frontend developer"),
                ["Junior Backend Developer"] = new Position("Junior Backend Developer", backendDept?.Id, "Entry-level backend developer"),
                ["UI/UX Designer"] = new Position("UI/UX Designer", frontendDept?.Id, "Designs user interfaces and experiences"),
            };

            foreach (var position in positions.Values)
            {
                await context.Positions.AddAsync(position);
            }

            logger?.LogInformation("Seeded {Count} default positions", positions.Count);

            return positions;
        }

        /// <summary>
        /// Creates the initial default users distributed across departments
        /// Includes Head of Company (Aqil Zeynalov)
        /// </summary>
        private static async Task SeedDefaultUsersAsync(
            IdentityDbContext context,
            IPasswordHasher passwordHasher,
            Company company,
            Dictionary<string, Department> departments,
            Dictionary<string, Position> positions,
            ILogger logger)
        {
            if (await context.Users.AnyAsync())
            {
                logger?.LogInformation("Users already exist, skipping default user seeding");
                return;
            }

            logger?.LogInformation("Seeding default users...");

            Department GetDept(string name) => departments.TryGetValue(name, out var dept) ? dept
                : context.Departments.Local.FirstOrDefault(d => d.Name == name)
                ?? throw new InvalidOperationException($"{name} department must be seeded before users");

            Position GetPos(string name) => positions.TryGetValue(name, out var pos) ? pos
                : context.Positions.Local.FirstOrDefault(p => p.Name == name)
                ?? throw new InvalidOperationException($"{name} position must be seeded before users");

            // ========== 0. Aqil Zeynalov - Head of Company ==========
            var headOfCompanyId = Guid.Parse("00000000-0000-0000-0000-000000000100");
            var headOfCompanyUser = new User("Aqil", "Zeynalov", "aqil.zeynalov@chatapp.com",
                passwordHasher.Hash("Password123!"), Role.Admin, null, company.Id) { Id = headOfCompanyId };
            await context.Users.AddAsync(headOfCompanyUser);
            var headOfCompanyEmp = new Employee(headOfCompanyId, new DateTime(1980, 1, 15), "+994501000000",
                "Head of Company - 166 Logistics", DateTime.UtcNow.AddYears(-15));
            await context.Employees.AddAsync(headOfCompanyEmp);
            company.AssignHead(headOfCompanyId);

            // ========== 1. Leyla Məmmədova - CFO ==========
            var user1Id = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var user1 = new User("Leyla", "Məmmədova", "leyla.mammadova@chatapp.com",
                passwordHasher.Hash("Password123!"), Role.Admin, null, company.Id) { Id = user1Id };
            await context.Users.AddAsync(user1);
            var emp1 = new Employee(user1Id, new DateTime(1985, 3, 15), "+994501234567",
                "Chief Financial Officer overseeing all financial operations", DateTime.UtcNow.AddYears(-8));
            emp1.AssignToDepartment(GetDept("Finance").Id);
            emp1.AssignToPosition(GetPos("Chief Financial Officer").Id);
            await context.Employees.AddAsync(emp1);
            GetDept("Finance").AssignHead(user1Id);

            // ========== 2. Rəşad Əliyev - Engineering Head ==========
            var user2Id = Guid.Parse("00000000-0000-0000-0000-000000000002");
            var user2 = new User("Rəşad", "Əliyev", "reshad.aliyev@chatapp.com",
                passwordHasher.Hash("Password123!"), Role.User, null, company.Id) { Id = user2Id };
            await context.Users.AddAsync(user2);
            var emp2 = new Employee(user2Id, new DateTime(1990, 7, 22), "+994502345678",
                "Engineering Department Head specializing in .NET and cloud architecture", DateTime.UtcNow.AddYears(-5));
            emp2.AssignToDepartment(GetDept("Engineering").Id);
            emp2.AssignToPosition(GetPos("Senior Backend Developer").Id);
            await context.Employees.AddAsync(emp2);

            // ========== 3. Aysel Həsənova - Frontend Development Head ==========
            var user3Id = Guid.Parse("00000000-0000-0000-0000-000000000003");
            var user3 = new User("Aysel", "Həsənova", "aysel.hasanova@chatapp.com",
                passwordHasher.Hash("Password123!"), Role.User, null, company.Id) { Id = user3Id };
            await context.Users.AddAsync(user3);
            var emp3 = new Employee(user3Id, new DateTime(1992, 11, 8), "+994503456789",
                "Frontend Development Head expert in React and modern web technologies", DateTime.UtcNow.AddYears(-4));
            emp3.AssignToDepartment(GetDept("Frontend Development").Id);
            emp3.AssignToPosition(GetPos("Senior Frontend Developer").Id);
            await context.Employees.AddAsync(emp3);
            GetDept("Frontend Development").AssignHead(user3Id);

            // ========== 4. Elvin Quliyev - Backend Developer ==========
            var user4Id = Guid.Parse("00000000-0000-0000-0000-000000000004");
            var user4 = new User("Elvin", "Quliyev", "elvin.guliyev@chatapp.com",
                passwordHasher.Hash("Password123!"), Role.User, null, company.Id) { Id = user4Id };
            await context.Users.AddAsync(user4);
            var emp4 = new Employee(user4Id, new DateTime(1995, 5, 18), "+994504567890",
                "Backend Developer working on microservices and APIs", DateTime.UtcNow.AddYears(-2));
            emp4.AssignToDepartment(GetDept("Backend Development").Id);
            emp4.AssignToPosition(GetPos("Backend Developer").Id);
            await context.Employees.AddAsync(emp4);

            // ========== 5. Günel İbrahimova - Frontend Developer ==========
            var user5Id = Guid.Parse("00000000-0000-0000-0000-000000000005");
            var user5 = new User("Günel", "İbrahimova", "gunel.ibrahimova@chatapp.com",
                passwordHasher.Hash("Password123!"), Role.User, null, company.Id) { Id = user5Id };
            await context.Users.AddAsync(user5);
            var emp5 = new Employee(user5Id, new DateTime(1994, 9, 25), "+994505678901",
                "Frontend Developer focused on UI/UX and responsive design", DateTime.UtcNow.AddYears(-3));
            emp5.AssignToDepartment(GetDept("Frontend Development").Id);
            emp5.AssignToPosition(GetPos("Frontend Developer").Id);
            await context.Employees.AddAsync(emp5);

            // ========== 6. Fərid Musayev - Sales & Marketing Head ==========
            var user6Id = Guid.Parse("00000000-0000-0000-0000-000000000006");
            var user6 = new User("Fərid", "Musayev", "farid.musayev@chatapp.com",
                passwordHasher.Hash("Password123!"), Role.User, null, company.Id) { Id = user6Id };
            await context.Users.AddAsync(user6);
            var emp6 = new Employee(user6Id, new DateTime(1988, 2, 14), "+994506789012",
                "Sales & Marketing Department Head leading the sales team and driving revenue growth", DateTime.UtcNow.AddYears(-6));
            emp6.AssignToDepartment(GetDept("Sales & Marketing").Id);
            emp6.AssignToPosition(GetPos("Sales Manager").Id);
            await context.Employees.AddAsync(emp6);
            GetDept("Sales").AssignHead(user6Id);
            GetDept("Sales & Marketing").AssignHead(user6Id);

            // ========== 7. Nigar Əhmədova - Sales Representative ==========
            var user7Id = Guid.Parse("00000000-0000-0000-0000-000000000007");
            var user7 = new User("Nigar", "Əhmədova", "nigar.ahmadova@chatapp.com",
                passwordHasher.Hash("Password123!"), Role.User, null, company.Id) { Id = user7Id };
            await context.Users.AddAsync(user7);
            var emp7 = new Employee(user7Id, new DateTime(1993, 6, 30), "+994507890123",
                "Sales Representative handling enterprise client relationships", DateTime.UtcNow.AddYears(-2));
            emp7.AssignToDepartment(GetDept("Sales").Id);
            emp7.AssignToPosition(GetPos("Sales Representative").Id);
            await context.Employees.AddAsync(emp7);

            // ========== 8. Kamran Abdullayev - Financial Analyst ==========
            var user8Id = Guid.Parse("00000000-0000-0000-0000-000000000008");
            var user8 = new User("Kamran", "Abdullayev", "kamran.abdullayev@chatapp.com",
                passwordHasher.Hash("Password123!"), Role.User, null, company.Id) { Id = user8Id };
            await context.Users.AddAsync(user8);
            var emp8 = new Employee(user8Id, new DateTime(1991, 12, 5), "+994508901234",
                "Financial Analyst providing detailed financial reports and analysis", DateTime.UtcNow.AddYears(-4));
            emp8.AssignToDepartment(GetDept("Finance").Id);
            emp8.AssignToPosition(GetPos("Financial Analyst").Id);
            await context.Employees.AddAsync(emp8);

            // ========== 9. Sevda Əsgərova - HR Manager ==========
            var user9Id = Guid.Parse("00000000-0000-0000-0000-000000000009");
            var user9 = new User("Sevda", "Əsgərova", "sevda.asgarova@chatapp.com",
                passwordHasher.Hash("Password123!"), Role.User, null, company.Id) { Id = user9Id };
            await context.Users.AddAsync(user9);
            var emp9 = new Employee(user9Id, new DateTime(1987, 4, 20), "+994509012345",
                "HR Manager overseeing recruitment, employee relations, and HR policies", DateTime.UtcNow.AddYears(-7));
            emp9.AssignToDepartment(GetDept("HR").Id);
            emp9.AssignToPosition(GetPos("HR Manager").Id);
            await context.Employees.AddAsync(emp9);
            GetDept("HR").AssignHead(user9Id);

            // ========== 10. Tural Məhəmmədov - HR Specialist ==========
            var user10Id = Guid.Parse("00000000-0000-0000-0000-000000000010");
            var user10 = new User("Tural", "Məhəmmədov", "tural.mahammadov@chatapp.com",
                passwordHasher.Hash("Password123!"), Role.User, null, company.Id) { Id = user10Id };
            await context.Users.AddAsync(user10);
            var emp10 = new Employee(user10Id, new DateTime(1996, 8, 12), "+994510123456",
                "HR Specialist handling recruitment and onboarding processes", DateTime.UtcNow.AddYears(-1));
            emp10.AssignToDepartment(GetDept("HR").Id);
            emp10.AssignToPosition(GetPos("HR Specialist").Id);
            await context.Employees.AddAsync(emp10);


            // ========== 0. Default SuperAdmin (platform-level, no company) ==========
            var superAdminId = Guid.Parse("00000000-0000-0000-0000-000000000099");
            var superAdmin = new User("Super", "Admin", "superadmin@chatapp.com",
                passwordHasher.Hash("SuperAdmin123!"), Role.SuperAdmin)
            { Id = superAdminId };
            await context.Users.AddAsync(superAdmin);
            // SuperAdmin has no Employee record — no company, no department, no position

            // ========== 11. System Administrator (company Admin) ==========
            var user11Id = Guid.Parse("00000000-0000-0000-0000-000000000011");
            var user11 = new User("System", "Administrator", "admin@chatapp.com",
                passwordHasher.Hash("Yusif2000+"), Role.Admin, null, company.Id)
            { Id = user11Id };
            await context.Users.AddAsync(user11);
            var emp11 = new Employee(user11Id, new DateTime(2000, 6, 23), "++994708074624",
                "System Administration", DateTime.UtcNow.AddYears(-4));
            emp11.AssignToDepartment(GetDept("Backend Development").Id);
            emp11.AssignToPosition(GetPos("Backend Developer").Id);
            await context.Employees.AddAsync(emp11);

            // Set Engineering department head
            GetDept("Engineering").AssignHead(user2Id);

            // =====================================================
            // 50 YENİ İSTİFADƏÇİ (Test üçün)
            // =====================================================
            var pwd = passwordHasher.Hash("Password123!");

            // Helper: user + employee yaratma
            async Task<Guid> AddUser(int idx, string first, string last, string email, string dept, string pos,
                DateTime? dob = null, string? phone = null, string? about = null, int yearsAgo = 1, Role role = Role.User)
            {
                var id = Guid.Parse($"00000000-0000-0000-0000-0000000000{idx:D2}");
                var user = new User(first, last, email, pwd, role, null, company.Id) { Id = id };
                await context.Users.AddAsync(user);
                var emp = new Employee(id, dob ?? new DateTime(1990 + (idx % 10), (idx % 12) + 1, (idx % 28) + 1),
                    phone ?? $"+99450{idx:D7}", about ?? $"{pos} at {dept}", DateTime.UtcNow.AddYears(-yearsAgo));
                emp.AssignToDepartment(GetDept(dept).Id);
                emp.AssignToPosition(GetPos(pos).Id);
                await context.Employees.AddAsync(emp);
                return id;
            }

            // --- QA & Testing (5 nəfər) ---
            var qaHeadId = await AddUser(12, "Vüsal", "Nəsibov", "vusal.nasibov@chatapp.com", "QA & Testing", "Senior QA Engineer", yearsAgo: 5);
            await AddUser(13, "Lalə", "Cəfərova", "lale.cafarova@chatapp.com", "QA & Testing", "QA Engineer", yearsAgo: 3);
            await AddUser(14, "Orxan", "Rəhimov", "orxan.rahimov@chatapp.com", "QA & Testing", "QA Engineer", yearsAgo: 2);
            await AddUser(15, "Şəbnəm", "Hüseynova", "shabnam.huseynova@chatapp.com", "QA & Testing", "QA Engineer", yearsAgo: 1);
            await AddUser(16, "Cavid", "Əkbərov", "cavid.akbarov@chatapp.com", "QA & Testing", "QA Engineer", yearsAgo: 1);
            GetDept("QA & Testing").AssignHead(qaHeadId);

            // --- DevOps (4 nəfər) ---
            var devopsHeadId = await AddUser(17, "Murad", "Babayev", "murad.babayev@chatapp.com", "DevOps", "Senior DevOps Engineer", yearsAgo: 6);
            await AddUser(18, "Aygün", "Vəliyeva", "aygun.valiyeva@chatapp.com", "DevOps", "DevOps Engineer", yearsAgo: 3);
            await AddUser(19, "Samir", "Novruzov", "samir.novruzov@chatapp.com", "DevOps", "DevOps Engineer", yearsAgo: 2);
            await AddUser(20, "Ülviyyə", "Kərimova", "ulviyya.karimova@chatapp.com", "DevOps", "DevOps Engineer", yearsAgo: 1);
            GetDept("DevOps").AssignHead(devopsHeadId);

            // --- IT Support (4 nəfər) ---
            var itHeadId = await AddUser(21, "Əli", "Sultanov", "ali.sultanov@chatapp.com", "IT Support", "IT Support Lead", yearsAgo: 4);
            await AddUser(22, "Nərmin", "Qasımova", "narmin.gasimova@chatapp.com", "IT Support", "IT Support Specialist", yearsAgo: 2);
            await AddUser(23, "Rauf", "İsmayılov", "rauf.ismayilov@chatapp.com", "IT Support", "IT Support Specialist", yearsAgo: 1);
            await AddUser(24, "Aynur", "Məmmədli", "aynur.mammadli@chatapp.com", "IT Support", "IT Support Specialist", yearsAgo: 1);
            GetDept("IT Support").AssignHead(itHeadId);

            // --- Marketing (5 nəfər) ---
            var mktHeadId = await AddUser(25, "Səbinə", "Əlizadə", "sabina.alizade@chatapp.com", "Marketing", "Marketing Manager", yearsAgo: 5);
            await AddUser(26, "Toğrul", "Həsənli", "togrul.hasanli@chatapp.com", "Marketing", "Marketing Specialist", yearsAgo: 3);
            await AddUser(27, "Gülay", "Bayramova", "gulay.bayramova@chatapp.com", "Marketing", "Marketing Specialist", yearsAgo: 2);
            await AddUser(28, "Ceyhun", "Əsgərov", "ceyhun.asgarov@chatapp.com", "Marketing", "Content Writer", yearsAgo: 1);
            await AddUser(29, "Ləman", "Hümbətova", "laman.humbatova@chatapp.com", "Marketing", "Content Writer", yearsAgo: 1);
            GetDept("Marketing").AssignHead(mktHeadId);

            // --- Accounting (4 nəfər) ---
            var accHeadId = await AddUser(30, "Tahir", "Mikayılov", "tahir.mikayilov@chatapp.com", "Accounting", "Senior Accountant", yearsAgo: 6);
            await AddUser(31, "Fatimə", "Rzayeva", "fatima.rzayeva@chatapp.com", "Accounting", "Accountant", yearsAgo: 3);
            await AddUser(32, "İlkin", "Sadıqov", "ilkin.sadigov@chatapp.com", "Accounting", "Accountant", yearsAgo: 2);
            await AddUser(33, "Nuranə", "Abbasova", "nurana.abbasova@chatapp.com", "Accounting", "Accountant", yearsAgo: 1);
            GetDept("Accounting").AssignHead(accHeadId);

            // --- Recruitment (3 nəfər) ---
            var recHeadId = await AddUser(34, "Zəhra", "Quluzadə", "zahra.guluzade@chatapp.com", "Recruitment", "Senior Recruiter", yearsAgo: 4);
            await AddUser(35, "Kənan", "Hüseynli", "kanan.huseynli@chatapp.com", "Recruitment", "Recruiter", yearsAgo: 2);
            await AddUser(36, "Gülnarə", "Tağıyeva", "gulnara.tagiyeva@chatapp.com", "Recruitment", "Recruiter", yearsAgo: 1);
            GetDept("Recruitment").AssignHead(recHeadId);

            // --- Legal (4 nəfər) ---
            var legalHeadId = await AddUser(37, "Ramin", "Əhmədov", "ramin.ahmadov@chatapp.com", "Legal", "Legal Counsel", yearsAgo: 7, role: Role.User);
            await AddUser(38, "Samirə", "Nəzərova", "samira.nazarova@chatapp.com", "Legal", "Legal Counsel", yearsAgo: 4);
            await AddUser(39, "Vüqar", "Hümmətov", "vugar.hummatov@chatapp.com", "Legal", "Legal Assistant", yearsAgo: 2);
            await AddUser(40, "Nigar", "Mehdiyeva", "nigar.mehdiyeva@chatapp.com", "Legal", "Legal Assistant", yearsAgo: 1);
            GetDept("Legal").AssignHead(legalHeadId);

            // --- Operations (5 nəfər) ---
            var opsHeadId = await AddUser(41, "Xəyal", "Aslanov", "xayal.aslanov@chatapp.com", "Operations", "Operations Manager", yearsAgo: 6, role: Role.User);
            await AddUser(42, "Pərvin", "Qəhrəmanova", "parvin.gahramanova@chatapp.com", "Operations", "Operations Coordinator", yearsAgo: 3);
            await AddUser(43, "Elnur", "Bağırov", "elnur.bagirov@chatapp.com", "Operations", "Operations Coordinator", yearsAgo: 2);
            await AddUser(44, "Sevinc", "Əmirova", "sevinc.amirova@chatapp.com", "Operations", "Operations Coordinator", yearsAgo: 1);
            await AddUser(45, "Fuad", "Hüseynzadə", "fuad.huseynzade@chatapp.com", "Operations", "Operations Coordinator", yearsAgo: 1);
            GetDept("Operations").AssignHead(opsHeadId);

            // --- Əlavə Backend Development (5 nəfər) ---
            await AddUser(46, "Cəmil", "Orucov", "cemil.orucov@chatapp.com", "Backend Development", "Backend Developer", yearsAgo: 3);
            await AddUser(47, "Türkan", "Nəcəfova", "turkan.nacafova@chatapp.com", "Backend Development", "Backend Developer", yearsAgo: 2);
            await AddUser(48, "Həsən", "Bəşirov", "hasan.bashirov@chatapp.com", "Backend Development", "Junior Backend Developer", yearsAgo: 1);
            await AddUser(49, "Lamiyə", "Əliyeva", "lamiya.aliyeva@chatapp.com", "Backend Development", "Junior Backend Developer", yearsAgo: 1);
            await AddUser(50, "Rəvan", "İbadov", "ravan.ibadov@chatapp.com", "Backend Development", "Senior Backend Developer", yearsAgo: 4);

            // --- Əlavə Frontend Development (5 nəfər) ---
            await AddUser(51, "Şahin", "Qədimov", "shahin.gadimov@chatapp.com", "Frontend Development", "Frontend Developer", yearsAgo: 3);
            await AddUser(52, "Xanım", "Məmmədzadə", "xanim.mammadzade@chatapp.com", "Frontend Development", "Junior Frontend Developer", yearsAgo: 1);
            await AddUser(53, "Vasif", "Salahov", "vasif.salahov@chatapp.com", "Frontend Development", "UI/UX Designer", yearsAgo: 2);
            await AddUser(54, "Nərgiz", "Əlibəyova", "nargiz.alibayova@chatapp.com", "Frontend Development", "Frontend Developer", yearsAgo: 2);
            await AddUser(55, "Tərlan", "Kərimzadə", "tarlan.karimzade@chatapp.com", "Frontend Development", "Junior Frontend Developer", yearsAgo: 1);

            // --- Əlavə Sales (3 nəfər) ---
            await AddUser(56, "Anar", "Hacıyev", "anar.haciyev@chatapp.com", "Sales", "Sales Representative", yearsAgo: 2);
            await AddUser(57, "Gülçin", "Muradova", "gulcin.muradova@chatapp.com", "Sales", "Sales Representative", yearsAgo: 1);
            await AddUser(58, "Emil", "Seyidov", "emil.seyidov@chatapp.com", "Sales", "Sales Representative", yearsAgo: 1);

            // --- Əlavə Finance (2 nəfər) ---
            await AddUser(59, "Mədinə", "Hüseynli", "madina.huseynli@chatapp.com", "Finance", "Financial Analyst", yearsAgo: 2);
            await AddUser(60, "Bəxtiyar", "Cəbrayılov", "baxtiyar.cabrayilov@chatapp.com", "Finance", "Financial Analyst", yearsAgo: 1);

            // --- Əlavə HR (1 nəfər) ---
            await AddUser(61, "İlahə", "Qəribova", "ilahe.garibova@chatapp.com", "HR", "HR Specialist", yearsAgo: 1);

            logger?.LogInformation("Seeded 61 users (11 original + 50 new) with employee records");
            logger?.LogWarning("SECURITY: All users have password 'Password123!' - Remember to change after first login!");
        }

        /// <summary>
        /// Assigns supervisors after all employees are persisted in the database.
        /// This must run as a separate step to avoid self-referencing FK violations.
        /// </summary>
        private static async Task AssignSupervisorsAsync(IdentityDbContext context, ILogger logger)
        {
            logger?.LogInformation("Assigning supervisors...");

            var headOfCompanyId = Guid.Parse("00000000-0000-0000-0000-000000000100");
            var user1Id = Guid.Parse("00000000-0000-0000-0000-000000000001"); // Leyla - Finance head
            var user2Id = Guid.Parse("00000000-0000-0000-0000-000000000002"); // Rəşad - Engineering/Backend head
            var user3Id = Guid.Parse("00000000-0000-0000-0000-000000000003"); // Aysel - Frontend head
            var user6Id = Guid.Parse("00000000-0000-0000-0000-000000000006"); // Fərid - Sales head
            var user9Id = Guid.Parse("00000000-0000-0000-0000-000000000009"); // Sevda - HR head

            // Load all employees from DB (SupervisorLinks include idempotency üçün)
            var employees = await context.Employees.Include(e => e.SupervisorLinks).ToListAsync();
            var getEmp = (Guid userId) => employees.First(e => e.UserId == userId);
            var getEmpId = (Guid userId) => getEmp(userId).Id;
            Guid Uid(int idx) => Guid.Parse($"00000000-0000-0000-0000-0000000000{idx:D2}");

            var headEmpId = getEmpId(headOfCompanyId);
            var emp1EmpId = getEmpId(user1Id);   // Finance head
            var emp2EmpId = getEmpId(user2Id);   // Engineering/Backend head
            var emp3EmpId = getEmpId(user3Id);   // Frontend head
            var emp6EmpId = getEmpId(user6Id);   // Sales head
            var emp9EmpId = getEmpId(user9Id);   // HR head

            // New subdepartment head Employee IDs
            var qaHeadEmpId = getEmpId(Uid(12));    // Vüsal - QA head
            var devopsHeadEmpId = getEmpId(Uid(17)); // Murad - DevOps head
            var itHeadEmpId = getEmpId(Uid(21));     // Əli - IT Support head
            var mktHeadEmpId = getEmpId(Uid(25));    // Səbinə - Marketing head
            var accHeadEmpId = getEmpId(Uid(30));    // Tahir - Accounting head
            var recHeadEmpId = getEmpId(Uid(34));    // Zəhra - Recruitment head
            var legalHeadEmpId = getEmpId(Uid(37));  // Ramin - Legal head
            var opsHeadEmpId = getEmpId(Uid(41));    // Xəyal - Operations head

            // ===== Top-level department heads → Head of Company =====
            getEmp(user1Id).AddSupervisor(headEmpId);   // Finance head
            getEmp(user2Id).AddSupervisor(headEmpId);   // Engineering head
            getEmp(user6Id).AddSupervisor(headEmpId);   // Sales & Marketing head
            getEmp(user9Id).AddSupervisor(headEmpId);   // HR head
            getEmp(Uid(37)).AddSupervisor(headEmpId);   // Legal head
            getEmp(Uid(41)).AddSupervisor(headEmpId);   // Operations head

            // ===== Sub-department heads → parent department head =====
            getEmp(user3Id).AddSupervisor(emp2EmpId);   // Frontend head → Engineering head
            getEmp(Uid(12)).AddSupervisor(emp2EmpId);   // QA head → Engineering head
            getEmp(Uid(17)).AddSupervisor(emp2EmpId);   // DevOps head → Engineering head
            getEmp(Uid(21)).AddSupervisor(emp2EmpId);   // IT Support head → Engineering head
            getEmp(Uid(25)).AddSupervisor(emp6EmpId);   // Marketing head → Sales & Marketing head
            getEmp(Uid(30)).AddSupervisor(emp1EmpId);   // Accounting head → Finance head
            getEmp(Uid(34)).AddSupervisor(emp9EmpId);   // Recruitment head → HR head

            // ===== Original employees =====
            getEmp(Uid(4)).AddSupervisor(emp2EmpId);    // Elvin → Backend/Engineering head
            getEmp(Uid(5)).AddSupervisor(emp3EmpId);    // Günel → Frontend head
            getEmp(Uid(7)).AddSupervisor(emp6EmpId);    // Nigar → Sales head
            getEmp(Uid(8)).AddSupervisor(emp1EmpId);    // Kamran → Finance head
            getEmp(Uid(10)).AddSupervisor(emp9EmpId);   // Tural → HR head
            getEmp(Uid(11)).AddSupervisor(emp2EmpId);   // System Admin → Backend/Engineering head

            // ===== QA & Testing employees → QA head =====
            getEmp(Uid(13)).AddSupervisor(qaHeadEmpId);
            getEmp(Uid(14)).AddSupervisor(qaHeadEmpId);
            getEmp(Uid(15)).AddSupervisor(qaHeadEmpId);
            getEmp(Uid(16)).AddSupervisor(qaHeadEmpId);

            // ===== DevOps employees → DevOps head =====
            getEmp(Uid(18)).AddSupervisor(devopsHeadEmpId);
            getEmp(Uid(19)).AddSupervisor(devopsHeadEmpId);
            getEmp(Uid(20)).AddSupervisor(devopsHeadEmpId);

            // ===== IT Support employees → IT Support head =====
            getEmp(Uid(22)).AddSupervisor(itHeadEmpId);
            getEmp(Uid(23)).AddSupervisor(itHeadEmpId);
            getEmp(Uid(24)).AddSupervisor(itHeadEmpId);

            // ===== Marketing employees → Marketing head =====
            getEmp(Uid(26)).AddSupervisor(mktHeadEmpId);
            getEmp(Uid(27)).AddSupervisor(mktHeadEmpId);
            getEmp(Uid(28)).AddSupervisor(mktHeadEmpId);
            getEmp(Uid(29)).AddSupervisor(mktHeadEmpId);

            // ===== Accounting employees → Accounting head =====
            getEmp(Uid(31)).AddSupervisor(accHeadEmpId);
            getEmp(Uid(32)).AddSupervisor(accHeadEmpId);
            getEmp(Uid(33)).AddSupervisor(accHeadEmpId);

            // ===== Recruitment employees → Recruitment head =====
            getEmp(Uid(35)).AddSupervisor(recHeadEmpId);
            getEmp(Uid(36)).AddSupervisor(recHeadEmpId);

            // ===== Legal employees → Legal head =====
            getEmp(Uid(38)).AddSupervisor(legalHeadEmpId);
            getEmp(Uid(39)).AddSupervisor(legalHeadEmpId);
            getEmp(Uid(40)).AddSupervisor(legalHeadEmpId);

            // ===== Operations employees → Operations head =====
            getEmp(Uid(42)).AddSupervisor(opsHeadEmpId);
            getEmp(Uid(43)).AddSupervisor(opsHeadEmpId);
            getEmp(Uid(44)).AddSupervisor(opsHeadEmpId);
            getEmp(Uid(45)).AddSupervisor(opsHeadEmpId);

            // ===== Əlavə Backend employees → Engineering/Backend head =====
            getEmp(Uid(46)).AddSupervisor(emp2EmpId);
            getEmp(Uid(47)).AddSupervisor(emp2EmpId);
            getEmp(Uid(48)).AddSupervisor(emp2EmpId);
            getEmp(Uid(49)).AddSupervisor(emp2EmpId);
            getEmp(Uid(50)).AddSupervisor(emp2EmpId);

            // ===== Əlavə Frontend employees → Frontend head =====
            getEmp(Uid(51)).AddSupervisor(emp3EmpId);
            getEmp(Uid(52)).AddSupervisor(emp3EmpId);
            getEmp(Uid(53)).AddSupervisor(emp3EmpId);
            getEmp(Uid(54)).AddSupervisor(emp3EmpId);
            getEmp(Uid(55)).AddSupervisor(emp3EmpId);

            // ===== Əlavə Sales employees → Sales head =====
            getEmp(Uid(56)).AddSupervisor(emp6EmpId);
            getEmp(Uid(57)).AddSupervisor(emp6EmpId);
            getEmp(Uid(58)).AddSupervisor(emp6EmpId);

            // ===== Əlavə Finance employees → Finance head =====
            getEmp(Uid(59)).AddSupervisor(emp1EmpId);
            getEmp(Uid(60)).AddSupervisor(emp1EmpId);

            // ===== Əlavə HR employee → HR head =====
            getEmp(Uid(61)).AddSupervisor(emp9EmpId);

            logger?.LogInformation("Assigned supervisors for all 62 employees");
        }
    }
}