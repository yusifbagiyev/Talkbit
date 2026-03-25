namespace ChatApp.Modules.Identity.Domain.Enums
{
    /// <summary>
    /// 3 səviyyəli rol sistemi: User (adi istifadəçi), Admin (şirkət administratoru), SuperAdmin (sistem administratoru).
    /// </summary>
    public enum Role
    {
        /// <summary>
        /// Regular user with default permissions.
        /// Default role for all new users.
        /// </summary>
        User = 0,

        /// <summary>
        /// Company administrator — manages users, departments, channels within own company.
        /// </summary>
        Admin = 1,

        /// <summary>
        /// System-wide super administrator — manages all companies, bypasses company scope.
        /// </summary>
        SuperAdmin = 2
    }
}