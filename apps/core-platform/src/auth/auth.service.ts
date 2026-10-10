import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OAuth2Client } from "google-auth-library";
import { User, UserRole } from "../entities/User.js";

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const clientId = this.configService.get<string>("GOOGLE_CLIENT_ID") || "mock_google_id";
    this.googleClient = new OAuth2Client(clientId);
  }

  async verifyGoogleToken(token: string): Promise<{ email: string; googleId: string; name: string }> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: this.configService.get<string>("GOOGLE_CLIENT_ID") || "mock_google_id",
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        throw new UnauthorizedException("Invalid Google token payload");
      }

      return {
        email: payload.email,
        googleId: payload.sub,
        name: payload.name || payload.email,
      };
    } catch (error) {
      throw new UnauthorizedException("Failed to verify Google token");
    }
  }

  /**
   * Determine the role for a user based on their email.
   * If the email matches OWNER_EMAIL env var, elevate to OWNER.
   */
  private resolveRole(email: string, currentRole?: UserRole): UserRole {
    let ownerEmail = this.configService.get<string>("OWNER_EMAIL");
    
    // Debug logging to help identify configuration issues on the VM
    console.log(`[AuthService] resolveRole called for email: '${email}', currentRole: '${currentRole}'`);
    console.log(`[AuthService] configService.get('OWNER_EMAIL') returned: '${ownerEmail}'`);

    if (ownerEmail) {
      // Clean up quotes and whitespace that might come from .env parsing
      ownerEmail = ownerEmail.replace(/['"]+/g, '').trim().toLowerCase();
      console.log(`[AuthService] Parsed ownerEmail: '${ownerEmail}'`);
      
      if (email.trim().toLowerCase() === ownerEmail) {
        console.log(`[AuthService] Match found! Elevating user to OWNER.`);
        return UserRole.OWNER;
      }
    }
    // Preserve existing role if already set (e.g., ADMIN promoted via DB)
    const finalRole = currentRole || UserRole.USER;
    console.log(`[AuthService] No match. Returning role: '${finalRole}'`);
    return finalRole;
  }

  async googleLogin(token: string): Promise<{ accessToken: string; user: { id: string; email: string; name: string; role: UserRole } }> {
    const { email, googleId, name } = await this.verifyGoogleToken(token);

    let user = await this.userRepository.findOne({ where: { googleId } });

    if (!user) {
      // New user registration
      const role = this.resolveRole(email);
      user = this.userRepository.create({ email, googleId, name, role });
      user = await this.userRepository.save(user);
    } else {
      // Existing user login — update profile and re-check OWNER status
      user.email = email;
      user.name = name;
      user.role = this.resolveRole(email, user.role);
      user = await this.userRepository.save(user);
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }

  async devLogin(): Promise<{ accessToken: string; user: { id: string; email: string; name: string; role: UserRole } }> {
    const devGoogleId = "dev-reviewer-id";
    const devEmail = "reviewer@leetcad.internal";
    const devName = "CAD Reviewer (Dev)";

    let user = await this.userRepository.findOne({ where: { googleId: devGoogleId } });

    if (!user) {
      const role = this.resolveRole(devEmail);
      user = this.userRepository.create({ email: devEmail, googleId: devGoogleId, name: devName, role });
      user = await this.userRepository.save(user);
    } else {
      user.role = this.resolveRole(devEmail, user.role);
      user = await this.userRepository.save(user);
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }
}
