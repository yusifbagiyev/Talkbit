using ChatApp.Modules.Identity.Domain.Entities;
using ChatApp.Modules.Identity.Domain.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace ChatApp.Modules.Identity.Infrastructure.Services
{
    public class JwtTokenGenerator(IConfiguration configuration) : ITokenGenerator
    {
        public string GenerateAccessToken(User user, List<string>? permissions)
        {
            var jwtSettings = configuration.GetSection("JwtSettings");
            var secret = jwtSettings["Secret"] ?? throw new InvalidOperationException("JWT Secret not configured");
            var issuer = jwtSettings["Issuer"] ?? "ChatApp";
            var audience = jwtSettings["Audience"] ?? "ChatApp";
            var expirationMinutes = int.Parse(jwtSettings["AccessTokenExpirationMinutes"] ?? "30");

            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            // JWT-də yalnız lazımi claim-lər: role + companyId
            // isAdmin/isSuperAdmin role-dan derive olunur (frontend və backend-də)
            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new(JwtRegisteredClaimNames.Email, user.Email),
                new(JwtRegisteredClaimNames.GivenName, user.FirstName),
                new(JwtRegisteredClaimNames.FamilyName, user.LastName),
                new(JwtRegisteredClaimNames.Name, user.FullName),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new("role", user.Role.ToString()),
                new("companyId", user.CompanyId?.ToString() ?? "")
            };

            if (permissions is not null)
            {
                //Add permissions as claims
                foreach (var permission in permissions)
                {
                    if (permission != null)
                    {
                        claims.Add(new("permission", permission));
                    }
                }
            }

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(expirationMinutes),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public string GenerateRefreshToken()
        {
            var randomNumber = new byte[64];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(randomNumber);
            return Convert.ToBase64String(randomNumber);
        }
    }
}